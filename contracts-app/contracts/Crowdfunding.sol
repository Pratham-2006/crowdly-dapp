// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Crowdfunding
/// @notice Multi-campaign crowdfunding. Funds are held by the contract until
///         the deadline: creator withdraws if goal met, contributors refund if not.
contract Crowdfunding {
    struct Campaign {
        address payable creator;
        string title;
        string description;
        string imageUrl;
        uint256 goal;          // in wei
        uint256 deadline;      // unix timestamp
        uint256 amountRaised;  // in wei
        bool withdrawn;
    }

    Campaign[] private campaigns;

    // campaignId => contributor => amount (wei)
    mapping(uint256 => mapping(address => uint256)) public contributions;

    event CampaignCreated(uint256 indexed id, address indexed creator, uint256 goal, uint256 deadline);
    event Contributed(uint256 indexed id, address indexed contributor, uint256 amount);
    event Withdrawn(uint256 indexed id, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed id, address indexed contributor, uint256 amount);

    modifier campaignExists(uint256 _id) {
        require(_id < campaigns.length, "Campaign does not exist");
        _;
    }

    /// @param _goal Funding goal in wei
    /// @param _durationInDays How long the campaign runs
    function createCampaign(
        string calldata _title,
        string calldata _description,
        string calldata _imageUrl,
        uint256 _goal,
        uint256 _durationInDays
    ) external returns (uint256 id) {
        require(bytes(_title).length > 0, "Title required");
        require(_goal > 0, "Goal must be > 0");
        require(_durationInDays > 0, "Duration must be > 0");

        uint256 deadline = block.timestamp + (_durationInDays * 1 days);

        campaigns.push(
            Campaign({
                creator: payable(msg.sender),
                title: _title,
                description: _description,
                imageUrl: _imageUrl,
                goal: _goal,
                deadline: deadline,
                amountRaised: 0,
                withdrawn: false
            })
        );

        id = campaigns.length - 1;
        emit CampaignCreated(id, msg.sender, _goal, deadline);
    }

    function contribute(uint256 _id) external payable campaignExists(_id) {
        Campaign storage c = campaigns[_id];
        require(block.timestamp < c.deadline, "Campaign ended");
        require(msg.value > 0, "Send some ETH");

        c.amountRaised += msg.value;
        contributions[_id][msg.sender] += msg.value;

        emit Contributed(_id, msg.sender, msg.value);
    }

    /// @notice Creator pulls the funds once the deadline passed and goal was met
    function withdraw(uint256 _id) external campaignExists(_id) {
        Campaign storage c = campaigns[_id];
        require(msg.sender == c.creator, "Only creator");
        require(block.timestamp >= c.deadline, "Campaign still running");
        require(c.amountRaised >= c.goal, "Goal not met");
        require(!c.withdrawn, "Already withdrawn");

        c.withdrawn = true;
        uint256 amount = c.amountRaised;

        (bool ok, ) = c.creator.call{value: amount}("");
        require(ok, "Transfer failed");

        emit Withdrawn(_id, c.creator, amount);
    }

    /// @notice Contributor reclaims their ETH if the goal was missed
    function refund(uint256 _id) external campaignExists(_id) {
        Campaign storage c = campaigns[_id];
        require(block.timestamp >= c.deadline, "Campaign still running");
        require(c.amountRaised < c.goal, "Goal was met");

        uint256 amount = contributions[_id][msg.sender];
        require(amount > 0, "Nothing to refund");

        // effects before interaction (prevents reentrancy)
        contributions[_id][msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund failed");

        emit Refunded(_id, msg.sender, amount);
    }

    // ---------- view helpers for the frontend ----------

    function getCampaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    function getCampaign(uint256 _id) external view campaignExists(_id) returns (Campaign memory) {
        return campaigns[_id];
    }

    function getAllCampaigns() external view returns (Campaign[] memory) {
        return campaigns;
    }
}
