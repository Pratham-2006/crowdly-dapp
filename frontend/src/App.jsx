import { useState, useCallback, useEffect } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import deployed from "./contracts/Crowdfunding.json";

const SUPPORTED_CHAIN_ID = BigInt(deployed.chainId);
const IS_SEPOLIA = deployed.chainId === 11155111;
const NETWORK_NAME = IS_SEPOLIA ? "Sepolia" : "Hardhat Local";
const EXPLORER = IS_SEPOLIA ? "https://sepolia.etherscan.io" : null;

const short = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

function formatTimeLeft(s) {
  if (s <= 0) return "Ended";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(m, 1)}m left`;
}

// Neo-brutalist building blocks: thick black borders, hard offset shadows, buttons that press in
const box = "border-[3px] border-black bg-white shadow-[6px_6px_0_0_#000]";
const press =
  "transition-all hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none disabled:pointer-events-none disabled:opacity-50";
const btn = `border-[3px] border-black px-4 py-2.5 font-extrabold shadow-[4px_4px_0_0_#000] ${press}`;
const field =
  "w-full border-[3px] border-black bg-white px-3 py-2 text-sm font-medium outline-none focus:bg-[#FFF3B0]";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&display=swap');
body { font-family: 'Bricolage Grotesque', system-ui, sans-serif; background: #fff; color: #000; }
@keyframes toast-in { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
.toast-in { animation: toast-in .2s ease-out; }
@media (prefers-reduced-motion: reduce) { .toast-in, .animate-spin, .animate-pulse { animation: none !important; } }
`;

export default function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("");
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // { type: "ok" | "err" | "pending", msg }

  const notify = (type, msg) => setToast({ type, msg });

  useEffect(() => {
    if (!toast || toast.type === "pending") return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadData = useCallback(async (c, p, acct) => {
    const [list, block, bal] = await Promise.all([c.getAllCampaigns(), p.getBlock("latest"), p.getBalance(acct)]);
    const mine = await Promise.all(list.map((_, i) => c.contributions(i, acct)));
    setCampaigns(
      list
        .map((x, i) => ({
          id: i,
          creator: x.creator,
          title: x.title,
          description: x.description,
          imageUrl: x.imageUrl,
          goal: x.goal,
          deadline: Number(x.deadline),
          amountRaised: x.amountRaised,
          withdrawn: x.withdrawn,
          myContribution: mine[i],
        }))
        .reverse()
    );
    setNow(block.timestamp);
    setBalance(formatEther(bal));
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    window.ethereum.on("accountsChanged", reload);
    window.ethereum.on("chainChanged", reload);
    return () => {
      window.ethereum.removeListener("accountsChanged", reload);
      window.ethereum.removeListener("chainChanged", reload);
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) return notify("err", "No wallet found. Install Rabby or MetaMask, then refresh.");
    setLoading(true);
    try {
      const p = new BrowserProvider(window.ethereum);
      const accounts = await p.send("eth_requestAccounts", []);
      const network = await p.getNetwork();
      if (network.chainId !== SUPPORTED_CHAIN_ID) {
        return notify("err", `Wrong network. Switch your wallet to ${NETWORK_NAME} (${SUPPORTED_CHAIN_ID}) and connect again.`);
      }
      const c = new Contract(deployed.address, deployed.abi, await p.getSigner());
      setProvider(p);
      setContract(c);
      setAccount(accounts[0]);
      await loadData(c, p, accounts[0]);
    } catch (e) {
      notify("err", e.shortMessage || e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runTx(fn, okMsg) {
    setBusy(true);
    notify("pending", "Confirm the transaction in your wallet...");
    try {
      const tx = await fn();
      notify("pending", "Waiting for the network to confirm...");
      await tx.wait();
      await loadData(contract, provider, account);
      notify("ok", okMsg);
      return true;
    } catch (e) {
      notify("err", e.shortMessage || e.reason || e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const createCampaign = (f) =>
    runTx(
      () => contract.createCampaign(f.title, f.description, f.imageUrl, parseEther(f.goal), BigInt(f.days)),
      "Campaign created."
    );
  const contribute = (id, amt) => runTx(() => contract.contribute(id, { value: parseEther(amt) }), "Contribution sent.");
  const withdraw = (id) => runTx(() => contract.withdraw(id), "Funds withdrawn.");
  const refund = (id) => runTx(() => contract.refund(id), "Refund received.");

  const totalRaised = campaigns.reduce((sum, c) => sum + c.amountRaised, 0n);

  return (
    <div className="min-h-screen">
      <style>{css}</style>

      <header className="border-b-[3px] border-black bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="border-[3px] border-black bg-[#FFD84D] px-3 py-1 text-2xl font-extrabold shadow-[4px_4px_0_0_#000]">
            Crowdly
          </div>
          {account && (
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="border-[3px] border-black bg-[#B6F23A] px-3 py-1">{NETWORK_NAME}</span>
              <span className="border-[3px] border-black bg-white px-3 py-1">{Number(balance).toFixed(3)} ETH</span>
              <span className="border-[3px] border-black bg-[#3B5BFF] px-3 py-1 text-white">{short(account)}</span>
            </div>
          )}
        </div>
      </header>

      <section className="border-b-[3px] border-black bg-[#FFD84D]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.95] tracking-tight md:text-7xl">
            Back ideas. Get your ETH back if they miss.
          </h1>
          <p className="mt-5 max-w-xl text-lg font-semibold">
            The contract holds every contribution until the deadline. Goal met: the creator withdraws. Goal missed: you
            claim a refund.
          </p>

          {!account ? (
            <button onClick={connectWallet} disabled={loading} className={`${btn} mt-8 bg-[#3B5BFF] text-lg text-white`}>
              {loading ? "Connecting..." : "Connect wallet"}
            </button>
          ) : (
            <div className="mt-8 flex flex-wrap gap-4">
              <Stat label="Campaigns" value={campaigns.length} bg="bg-white" />
              <Stat label="ETH raised" value={Number(formatEther(totalRaised)).toFixed(3)} bg="bg-[#FF4FA3]" />
              {EXPLORER && (
                <a
                  href={`${EXPLORER}/address/${deployed.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btn} self-end bg-white`}
                >
                  View contract on Etherscan
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {account && (
        <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-3">
          <section className="md:col-span-1">
            <CreateForm onCreate={createCampaign} busy={busy} />
          </section>

          <section className="md:col-span-2">
            <h2 className="mb-5 text-3xl font-extrabold">Campaigns</h2>
            {loading ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className={`${box} h-64 animate-pulse bg-slate-200`} />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className={`${box} p-8 text-lg font-bold`}>
                No campaigns yet. Fill in the form to start the first one.
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {campaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    c={c}
                    now={now}
                    busy={busy}
                    isOwner={c.creator.toLowerCase() === account.toLowerCase()}
                    onContribute={contribute}
                    onWithdraw={withdraw}
                    onRefund={refund}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Stat({ label, value, bg }) {
  return (
    <div className={`border-[3px] border-black px-5 py-3 shadow-[4px_4px_0_0_#000] ${bg}`}>
      <div className="text-4xl font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-sm font-bold">{label}</div>
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-black border-t-transparent" />;
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const bg = { ok: "bg-[#B6F23A]", err: "bg-[#FF4FA3]", pending: "bg-[#FFD84D]" }[toast.type];
  return (
    <div
      role="status"
      className={`toast-in fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 border-[3px] border-black px-4 py-3 font-bold shadow-[6px_6px_0_0_#000] ${bg}`}
    >
      {toast.type === "pending" && <Spinner />}
      <span>{toast.msg}</span>
      {toast.type !== "pending" && (
        <button onClick={onClose} aria-label="Dismiss" className="ml-2 border-[3px] border-black bg-white px-2 leading-none">
          x
        </button>
      )}
    </div>
  );
}

function CreateForm({ onCreate, busy }) {
  const empty = { title: "", description: "", imageUrl: "", goal: "", days: "7" };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    if (await onCreate(f)) setF(empty);
  }

  return (
    <div className={`${box} p-5 md:sticky md:top-6`}>
      <h2 className="mb-4 text-2xl font-extrabold">Start a campaign</h2>
      <div className="space-y-3">
        <input className={field} placeholder="Title" value={f.title} onChange={set("title")} />
        <textarea className={field} rows={3} placeholder="What are you raising money for?" value={f.description} onChange={set("description")} />
        <input className={field} placeholder="Image URL (optional)" value={f.imageUrl} onChange={set("imageUrl")} />
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="Goal (ETH)" value={f.goal} onChange={set("goal")} />
          <input className={field} placeholder="Days to run" value={f.days} onChange={set("days")} />
        </div>
        <button onClick={submit} disabled={busy} className={`${btn} flex w-full items-center justify-center gap-2 bg-[#3B5BFF] text-white`}>
          {busy && <Spinner />}
          {busy ? "Working..." : "Create campaign"}
        </button>
      </div>
    </div>
  );
}

function CampaignCard({ c, now, busy, isOwner, onContribute, onWithdraw, onRefund }) {
  const [amount, setAmount] = useState("");
  const ended = now >= c.deadline;
  const funded = c.amountRaised >= c.goal;
  const pct = Math.min(100, Number((c.amountRaised * 10000n) / c.goal) / 100);

  const badge = !ended
    ? { label: "Active", cls: "bg-[#B6F23A]" }
    : funded
    ? { label: "Funded", cls: "bg-[#3B5BFF] text-white" }
    : { label: "Missed goal", cls: "bg-[#FF4FA3]" };

  async function submit() {
    if (await onContribute(c.id, amount)) setAmount("");
  }

  const note = "border-[3px] border-black bg-slate-100 px-3 py-2 text-center text-sm font-bold";

  return (
    <article className={`${box} relative`}>
      <span className={`absolute -top-3 right-3 z-10 rotate-2 border-[3px] border-black px-3 py-0.5 text-sm font-extrabold ${badge.cls}`}>
        {badge.label}
      </span>

      {c.imageUrl && (
        <img
          src={c.imageUrl}
          alt={c.title}
          className="h-40 w-full border-b-[3px] border-black object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}

      <div className="p-5">
        <h3 className="text-xl font-extrabold leading-tight">{c.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm font-medium">{c.description}</p>
        <p className="mt-2 text-sm font-semibold">
          by{" "}
          {EXPLORER ? (
            <a href={`${EXPLORER}/address/${c.creator}`} target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-2 hover:bg-[#FFD84D]">
              {short(c.creator)}
            </a>
          ) : (
            short(c.creator)
          )}
          {isOwner && " (you)"}
        </p>

        <div className="mt-4">
          <div className="h-5 border-[3px] border-black bg-white">
            <div className={`h-full border-r-[3px] border-black ${funded ? "bg-[#B6F23A]" : "bg-[#3B5BFF]"} ${pct === 0 ? "hidden" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-sm font-bold">
            <span>
              {formatEther(c.amountRaised)} of {formatEther(c.goal)} ETH
            </span>
            <span>
              {pct.toFixed(0)}%, {formatTimeLeft(c.deadline - now)}
            </span>
          </div>
        </div>

        {!ended && (
          <div className="mt-4 flex gap-2">
            <input className={field} placeholder="Amount (ETH)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button onClick={submit} disabled={busy || !amount} className={`${btn} shrink-0 bg-[#FFD84D]`}>
              Contribute
            </button>
          </div>
        )}

        {ended && (
          <div className="mt-4">
            {funded ? (
              c.withdrawn ? (
                <p className={note}>The creator has withdrawn the funds.</p>
              ) : isOwner ? (
                <button onClick={() => onWithdraw(c.id)} disabled={busy} className={`${btn} w-full bg-[#B6F23A]`}>
                  Withdraw {formatEther(c.amountRaised)} ETH
                </button>
              ) : (
                <p className={note}>Goal reached. The creator can now withdraw.</p>
              )
            ) : c.myContribution > 0n ? (
              <button onClick={() => onRefund(c.id)} disabled={busy} className={`${btn} w-full bg-[#FF4FA3]`}>
                Refund my {formatEther(c.myContribution)} ETH
              </button>
            ) : (
              <p className={note}>Goal missed. Contributors can claim refunds.</p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}