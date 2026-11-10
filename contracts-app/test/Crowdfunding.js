const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Crowdfunding", function () {
  const ONE_ETH = ethers.parseEther("1");
  const WEEK = 7 * 24 * 60 * 60;

  async function deployFixture() {
    const [creator, alice, bob] = await ethers.getSigners();
    const Crowdfunding = await ethers.getContractFactory("Crowdfunding");
    const cf = await Crowdfunding.deploy();
    await cf.waitForDeployment();
    return { cf, creator, alice, bob };
  }

  // deploys + creates campaign #0 (goal 1 ETH, 7 days) by `creator`
  async function campaignFixture() {
    const base = await deployFixture();
    await base.cf.createCampaign("Test", "Desc", "https://img.test/a.png", ONE_ETH, 7);
    return base;
  }

  describe("createCampaign", function () {
    it("creates a campaign with correct data", async function () {
      const { cf, creator } = await loadFixture(campaignFixture);
      const c = await cf.getCampaign(0);
      expect(c.creator).to.equal(creator.address);
      expect(c.title).to.equal("Test");
      expect(c.goal).to.equal(ONE_ETH);
      expect(c.amountRaised).to.equal(0);
      expect(await cf.getCampaignCount()).to.equal(1);
    });

    it("rejects empty title", async function () {
      const { cf } = await loadFixture(deployFixture);
      await expect(cf.createCampaign("", "d", "", ONE_ETH, 7)).to.be.revertedWith("Title required");
    });

    it("rejects zero goal", async function () {
      const { cf } = await loadFixture(deployFixture);
      await expect(cf.createCampaign("T", "d", "", 0, 7)).to.be.revertedWith("Goal must be > 0");
    });
  });

  describe("contribute", function () {
    it("accepts contributions and tracks them", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await expect(cf.connect(alice).contribute(0, { value: ONE_ETH / 2n }))
        .to.emit(cf, "Contributed")
        .withArgs(0, alice.address, ONE_ETH / 2n);

      expect((await cf.getCampaign(0)).amountRaised).to.equal(ONE_ETH / 2n);
      expect(await cf.contributions(0, alice.address)).to.equal(ONE_ETH / 2n);
    });

    it("rejects zero-value contributions", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await expect(cf.connect(alice).contribute(0, { value: 0 })).to.be.revertedWith("Send some ETH");
    });

    it("rejects contributions after the deadline", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await time.increase(WEEK + 1);
      await expect(cf.connect(alice).contribute(0, { value: ONE_ETH })).to.be.revertedWith("Campaign ended");
    });

    it("rejects unknown campaign id", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await expect(cf.connect(alice).contribute(99, { value: ONE_ETH })).to.be.revertedWith(
        "Campaign does not exist"
      );
    });
  });

  describe("withdraw", function () {
    it("lets creator withdraw after deadline when goal is met", async function () {
      const { cf, creator, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH });
      await time.increase(WEEK + 1);

      await expect(cf.withdraw(0)).to.changeEtherBalances([cf, creator], [-ONE_ETH, ONE_ETH]);
    });

    it("blocks withdrawal before the deadline", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH });
      await expect(cf.withdraw(0)).to.be.revertedWith("Campaign still running");
    });

    it("blocks withdrawal if goal not met", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH / 2n });
      await time.increase(WEEK + 1);
      await expect(cf.withdraw(0)).to.be.revertedWith("Goal not met");
    });

    it("blocks non-creators", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH });
      await time.increase(WEEK + 1);
      await expect(cf.connect(alice).withdraw(0)).to.be.revertedWith("Only creator");
    });

    it("blocks double withdrawal", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH });
      await time.increase(WEEK + 1);
      await cf.withdraw(0);
      await expect(cf.withdraw(0)).to.be.revertedWith("Already withdrawn");
    });
  });

  describe("refund", function () {
    it("refunds contributors when goal is missed", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH / 2n });
      await time.increase(WEEK + 1);

      await expect(cf.connect(alice).refund(0)).to.changeEtherBalances(
        [cf, alice],
        [-(ONE_ETH / 2n), ONE_ETH / 2n]
      );
    });

    it("blocks refund when goal was met", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH });
      await time.increase(WEEK + 1);
      await expect(cf.connect(alice).refund(0)).to.be.revertedWith("Goal was met");
    });

    it("blocks refund before the deadline", async function () {
      const { cf, alice } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH / 2n });
      await expect(cf.connect(alice).refund(0)).to.be.revertedWith("Campaign still running");
    });

    it("blocks double refund and non-contributors", async function () {
      const { cf, alice, bob } = await loadFixture(campaignFixture);
      await cf.connect(alice).contribute(0, { value: ONE_ETH / 2n });
      await time.increase(WEEK + 1);

      await cf.connect(alice).refund(0);
      await expect(cf.connect(alice).refund(0)).to.be.revertedWith("Nothing to refund");
      await expect(cf.connect(bob).refund(0)).to.be.revertedWith("Nothing to refund");
    });
  });
});