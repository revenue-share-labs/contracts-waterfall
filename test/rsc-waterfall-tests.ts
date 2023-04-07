import { expect } from "chai";
import { ethers } from "hardhat";
const { constants } = require("@openzeppelin/test-helpers");

async function deployRSCWaterfallContract(
  controller: any,
  distributors: any,
  immutableController: any,
  autoNativeTokenDistribution: any,
  minAutoDistributeAmount: any,
  initialRecipients: any,
  maxCaps: any,
  priorities: any,
  supportedErc20addresses: any
) {
  const EthPriceFeedMock = await ethers.getContractFactory("EthPriceFeedMock");
  const ethPriceFeedMock = await EthPriceFeedMock.deploy();
  await ethPriceFeedMock.deployed();

  const XLARSCWaterfallFactory = await ethers.getContractFactory(
    "XLARSCWaterfallFactory"
  );
  const xlaRSCWaterfallFactory = await XLARSCWaterfallFactory.deploy();
  await xlaRSCWaterfallFactory.deployed();

  const tx = await xlaRSCWaterfallFactory.createRSCWaterfall({
    controller: controller,
    distributors: distributors,
    immutableController: immutableController,
    autoNativeTokenDistribution: autoNativeTokenDistribution,
    minAutoDistributeAmount: minAutoDistributeAmount,
    initialRecipients: initialRecipients,
    maxCaps: maxCaps,
    priorities: priorities,
    supportedErc20addresses: supportedErc20addresses,
    erc20PriceFeeds: [ethPriceFeedMock.address],
    creationId: constants.ZERO_BYTES32,
  });

  let receipt = await tx.wait();
  const rscWaterfallContractAddress = receipt.events?.[5].args?.[0];

  const XLARSCWaterfall = await ethers.getContractFactory("XLARSCWaterfall");
  const xlaRSCWaterfall = await XLARSCWaterfall.attach(
    rscWaterfallContractAddress
  );
  return xlaRSCWaterfall;
}

describe("XLA RSC Waterfall tests", function () {
  let xlaRSCWaterfall: any;
  let baseToken: any;
  let testToken: any;

  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;
  let addr4: any;
  let addr5: any;
  let addrs: any;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, addr4, addr5, ...addrs] =
      await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    baseToken = await TestToken.deploy("BaseToken", "BTKN", 1000000000);
    await baseToken.deployed();

    testToken = await TestToken.deploy("TestToken", "TTT", 1000000000);
    await testToken.deployed();

    xlaRSCWaterfall = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      true,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("10")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );
    await xlaRSCWaterfall.deployed();
  });

  it("Should set base attrs correctly", async () => {
    // Contract settings
    expect(await xlaRSCWaterfall.owner()).to.be.equal(owner.address);
    expect(await xlaRSCWaterfall.distributors(owner.address)).to.be.true;
    expect(await xlaRSCWaterfall.controller()).to.be.equal(owner.address);
    expect(await xlaRSCWaterfall.numberOfRecipients()).to.be.equal(BigInt(1));
    expect(await xlaRSCWaterfall.platformFee()).to.be.equal(0);

    // Recipients settings
    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr2.address);
    expect(await xlaRSCWaterfall.recipients(0)).to.be.equal(addr1.address);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100"));
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).priority
    ).to.be.equal(10);

    expect(
      (await xlaRSCWaterfall.recipientsData(addr2.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("10"));
    expect(
      (await xlaRSCWaterfall.recipientsData(addr2.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr2.address)).priority
    ).to.be.equal(20);
  });

  it("Should add recipients correctly", async () => {
    await expect(
      xlaRSCWaterfall
        .connect(addr3)
        .setRecipients([addr3.address], [2000], [BigInt(10)])
    ).to.be.revertedWithCustomError(xlaRSCWaterfall, "OnlyControllerError");

    await xlaRSCWaterfall.setRecipients(
      [addr1.address, addr3.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(30), BigInt(20)]
    );

    expect(await xlaRSCWaterfall.numberOfRecipients()).to.be.equal(BigInt(2));
    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr2.address);
    expect(await xlaRSCWaterfall.recipients(0)).to.be.equal(addr1.address);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100"));
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).priority
    ).to.be.equal(30);

    expect(await xlaRSCWaterfall.recipients(1)).to.be.equal(addr3.address);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr3.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("50"));
    expect(
      (await xlaRSCWaterfall.recipientsData(addr3.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr3.address)).priority
    ).to.be.equal(20);

    await expect(xlaRSCWaterfall.recipients(2)).to.be.revertedWithoutReason();

    await expect(
      xlaRSCWaterfall.setRecipients(
        [addr1.address, addr1.address],
        [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
        [BigInt(30), BigInt(20)]
      )
    ).to.be.revertedWithCustomError(
      xlaRSCWaterfall,
      "RecipientAlreadyAddedError"
    );
  });

  it("Should redistribute funds correctly", async () => {
    // First Buy
    // Send 1/2 of max cap to addr2

    const addr1BalanceBefore = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceBefore = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();

    const txHashFirstBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("5"),
    });

    const addr1BalanceAfterFirstBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterFirstBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();

    expect(addr1BalanceBefore).to.be.equal(addr1BalanceAfterFirstBuy);
    expect(
      addr2BalanceBefore + ethers.utils.parseEther("5").toBigInt()
    ).to.be.equal(addr2BalanceAfterFirstBuy);

    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr2.address);

    expect(
      (await xlaRSCWaterfall.recipientsData(addr2.address)).received
    ).to.be.equal(ethers.utils.parseEther("5"));

    // Second Buy
    // Send rest of max cap to addr2, should switch currentRecipient to addr1

    const txHashSecondBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("5"),
    });

    const addr1BalanceAfterSecondBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterSecondBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();

    expect(addr1BalanceBefore).to.be.equal(addr1BalanceAfterSecondBuy);

    expect(
      addr2BalanceAfterFirstBuy + ethers.utils.parseEther("5").toBigInt()
    ).to.be.equal(addr2BalanceAfterSecondBuy);

    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr1.address);
    await expect(xlaRSCWaterfall.recipients(0)).to.revertedWithoutReason();
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).received
    ).to.be.equal(0);

    // "third Buy"
    // send 1/99 to addr1, should stay as current recipient

    const txHashThirdBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("1"),
    });

    const addr1BalanceAfterThirdBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterThirdBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();

    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr1.address);
    expect(
      (await xlaRSCWaterfall.recipientsData(addr1.address)).received
    ).to.be.equal(ethers.utils.parseEther("1"));

    // Fourth buy
    // send rest to addr1 and 1 eth on top, currentRecipient should be ZERO_ADDRESS because there are no more recipients
    // contract should have balance of 1

    const txHashFourthBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("100"),
    });

    const addr1BalanceAfterFourthBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterFourthBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    const rscContractBalance = (
      await ethers.provider.getBalance(xlaRSCWaterfall.address)
    ).toBigInt();

    expect(rscContractBalance).to.be.equal(ethers.utils.parseEther("1"));
    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(
      constants.ZERO_ADDRESS
    );
    await expect(xlaRSCWaterfall.recipients(0)).to.revertedWithoutReason();

    // Fifth buy
    // Send 4 Eth to RSC, because there is no currentRecipient all eth will be send to contract

    const txHashFifthBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("4"),
    });

    const rscContractBalanceEmptyBuy = (
      await ethers.provider.getBalance(xlaRSCWaterfall.address)
    ).toBigInt();
    expect(rscContractBalanceEmptyBuy).to.be.equal(
      ethers.utils.parseEther("5")
    );

    // Sixth buy
    // Set new recipients and currentRecipient (addr3) should receive 5 eth from RSC contract
    await xlaRSCWaterfall.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10")],
      [BigInt(10)]
    );

    const addr3BalanceBefore = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    const txHashSixthBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("5"),
    });

    const addr3BalanceAfter = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    expect(
      await ethers.provider.getBalance(xlaRSCWaterfall.address)
    ).to.be.equal(0);
    expect(
      addr3BalanceBefore + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(addr3BalanceAfter);
    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(
      constants.ZERO_ADDRESS
    );

    // Seventh buy
    // Set 3 recipients and 2 of them should be fulfilled in 1 TX
    await xlaRSCWaterfall.setRecipients(
      [addr1.address, addr2.address, addr3.address],
      [
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("10"),
      ],
      [BigInt(30), BigInt(20), BigInt(10)]
    );

    const addr1BalanceBeforeSeventhdBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceBeforeSeventhdBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    const addr3BalanceBeforeSeventhdBuy = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    const txHashSeventhBuy = await owner.sendTransaction({
      to: xlaRSCWaterfall.address,
      value: ethers.utils.parseEther("25"),
    });

    const addr1BalanceAfterSeventhdBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterSeventhdBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    const addr3BalanceAfterSeventhdBuy = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    expect(await xlaRSCWaterfall.numberOfRecipients()).to.be.equal(BigInt(0));
    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr3.address);
    expect(
      (await ethers.provider.getBalance(xlaRSCWaterfall.address)).toBigInt()
    ).to.be.equal(0);

    expect(
      addr1BalanceBeforeSeventhdBuy + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(addr1BalanceAfterSeventhdBuy);
    expect(
      addr2BalanceBeforeSeventhdBuy + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(addr2BalanceAfterSeventhdBuy);
    expect(
      addr3BalanceBeforeSeventhdBuy + ethers.utils.parseEther("5").toBigInt()
    ).to.be.equal(addr3BalanceAfterSeventhdBuy);

    expect(
      (await xlaRSCWaterfall.recipientsData(addr3.address)).received
    ).to.be.equal(ethers.utils.parseEther("5"));

    // TODO Test set recipients between buyes
  });

  it("Should redistribute ERC20 token", async () => {
    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    await baseToken.transfer(
      xlaRSCWaterfall.address,
      ethers.utils.parseEther("100000")
    );

    await xlaRSCWaterfall.setTokenNativeTokenPriceFeed(
      baseToken.address,
      ethPriceFeedMock.address
    );
    await xlaRSCWaterfall.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(xlaRSCWaterfall.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(addr1.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(addr2.address)).to.be.equal(
      ethers.utils.parseEther("100000")
    );
    expect(await xlaRSCWaterfall.currentRecipient()).to.be.equal(addr1.address);
    expect(await xlaRSCWaterfall.numberOfRecipients()).to.be.equal(BigInt(0));

    await baseToken.transfer(
      xlaRSCWaterfall.address,
      ethers.utils.parseEther("1050000")
    );
    await xlaRSCWaterfall.redistributeToken(baseToken.address);
    expect(await baseToken.balanceOf(xlaRSCWaterfall.address)).to.be.equal(
      ethers.utils.parseEther("50000")
    );
    expect(await baseToken.balanceOf(addr1.address)).to.be.equal(
      ethers.utils.parseEther("1000000")
    );
    expect(await baseToken.balanceOf(addr2.address)).to.be.equal(
      ethers.utils.parseEther("100000")
    );

    await xlaRSCWaterfall.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10000")],
      [BigInt(10)]
    );
    await testToken.transfer(
      xlaRSCWaterfall.address,
      ethers.utils.parseEther("100")
    );
    await expect(
      xlaRSCWaterfall.redistributeToken(testToken.address)
    ).to.be.revertedWithCustomError(
      xlaRSCWaterfall,
      "TokenMissingNativeTokenPriceOracle"
    );

    await expect(
      xlaRSCWaterfall.connect(addr1).redistributeToken(baseToken.address)
    ).to.be.revertedWithCustomError(xlaRSCWaterfall, "OnlyDistributorError");

    await expect(
      xlaRSCWaterfall.connect(addr1).setDistributor(addr3.address, true)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await xlaRSCWaterfall.setDistributor(addr1.address, true);
    await xlaRSCWaterfall.connect(addr1).redistributeToken(baseToken.address);
  });

  it("Should initialize only once", async () => {
    await expect(
      xlaRSCWaterfall.initialize(
        {
          owner: addr2.address,
          controller: addr2.address,
          _distributors: [addr2.address],
          immutableController: true,
          autoNativeTokenDistribution: false,
          minAutoDistributionAmount: ethers.utils.parseEther("1"),
          platformFee: BigInt(0),
          factoryAddress: addr1.address,
          supportedErc20addresses: [],
          erc20PriceFeeds: [],
        },
        [addr1.address],
        [BigInt(10000)],
        [BigInt(10)]
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should transfer ownership correctly", async () => {
    await xlaRSCWaterfall.transferOwnership(addr1.address);
    expect(await xlaRSCWaterfall.owner()).to.be.equal(addr1.address);
  });

  it("Should deploy and create immutable contract", async () => {
    const rscWaterfallImmutable = await deployRSCWaterfallContract(
      constants.ZERO_ADDRESS,
      [owner.address],
      true,
      true,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("10")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    await expect(
      rscWaterfallImmutable.setRecipients(
        [addr1.address, addr2.address],
        [ethers.utils.parseEther("100"), ethers.utils.parseEther("10")],
        [BigInt(10), BigInt(20)]
      )
    ).to.be.revertedWithCustomError(
      rscWaterfallImmutable,
      "OnlyControllerError"
    );

    await expect(
      rscWaterfallImmutable.connect(addr2).setController(addr2.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      rscWaterfallImmutable.setController(addr1.address)
    ).to.be.revertedWithCustomError(
      rscWaterfallImmutable,
      "ImmutableControllerError"
    );
  });

  it("Should create manual distribution split", async () => {
    const rscWaterfallManualDistribution = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const transactionHash = await owner.sendTransaction({
      to: rscWaterfallManualDistribution.address,
      value: ethers.utils.parseEther("50"),
    });

    const contractBalance = (
      await ethers.provider.getBalance(rscWaterfallManualDistribution.address)
    ).toBigInt();
    expect(contractBalance).to.be.equal(ethers.utils.parseEther("50"));

    await expect(
      rscWaterfallManualDistribution.connect(addr3).redistributeNativeToken()
    ).to.be.revertedWithCustomError(
      rscWaterfallManualDistribution,
      "OnlyDistributorError"
    );

    const priorityRecipientBeforeBalance = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    await rscWaterfallManualDistribution.redistributeNativeToken();

    const contractBalance2 = (
      await ethers.provider.getBalance(rscWaterfallManualDistribution.address)
    ).toBigInt();
    expect(contractBalance2).to.be.equal(0);

    const investorBalanceAfter = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    expect(investorBalanceAfter).to.be.equal(
      priorityRecipientBeforeBalance + ethers.utils.parseEther("50").toBigInt()
    );
  });

  it("Should work with fees Correctly", async () => {
    const RSCWaterfallFeeFactory = await ethers.getContractFactory(
      "XLARSCWaterfallFactory"
    );
    const rscWaterfallFeeFactory = await RSCWaterfallFeeFactory.deploy();
    await rscWaterfallFeeFactory.deployed();

    await expect(
      rscWaterfallFeeFactory.connect(addr1).setPlatformFee(BigInt(1))
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      rscWaterfallFeeFactory.setPlatformFee(BigInt(10000001))
    ).to.be.revertedWithCustomError(
      rscWaterfallFeeFactory,
      "InvalidFeePercentage"
    );

    await expect(
      rscWaterfallFeeFactory.connect(addr1).setPlatformWallet(addr2.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await rscWaterfallFeeFactory.setPlatformWallet(addr4.address);
    await rscWaterfallFeeFactory.setPlatformFee(BigInt(5000000));

    const platformWallet = addr4.address;
    expect(await rscWaterfallFeeFactory.platformWallet()).to.be.equal(
      platformWallet
    );
    expect(await rscWaterfallFeeFactory.platformFee()).to.be.equal(
      BigInt(5000000)
    );

    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    const txFee = await rscWaterfallFeeFactory.createRSCWaterfall({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      initialRecipients: [addr1.address, addr2.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: constants.ZERO_BYTES32,
    });

    let receipt = await txFee.wait();
    const revenueShareContractAddress = receipt.events?.[5].args?.[0];
    const XLARevenueShareContract = await ethers.getContractFactory(
      "XLARSCWaterfall"
    );
    const xlaRSCFeeWaterfall = await XLARevenueShareContract.attach(
      revenueShareContractAddress
    );

    const platformWalletBalanceBefore = (
      await ethers.provider.getBalance(platformWallet)
    ).toBigInt();
    const addr2BalanceBefore = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    const addr1BalanceBefore = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();

    const transactionHash = await owner.sendTransaction({
      to: xlaRSCFeeWaterfall.address,
      value: ethers.utils.parseEther("50"),
    });

    const platformWalletBalanceAfter = (
      await ethers.provider.getBalance(platformWallet)
    ).toBigInt();
    const addr2BalanceAfter = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    const addr1BalanceAfter = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();

    expect(platformWalletBalanceAfter).to.be.equal(
      platformWalletBalanceBefore + ethers.utils.parseEther("25").toBigInt()
    );
    expect(addr2BalanceAfter).to.be.equal(
      addr2BalanceBefore + ethers.utils.parseEther("10").toBigInt()
    );
    expect(addr1BalanceAfter).to.be.equal(
      addr1BalanceBefore + ethers.utils.parseEther("15").toBigInt()
    );

    await baseToken.transfer(
      xlaRSCFeeWaterfall.address,
      ethers.utils.parseEther("1000000")
    );

    await xlaRSCFeeWaterfall.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(platformWallet)).to.be.equal(
      ethers.utils.parseEther("500000")
    );
    expect(await baseToken.balanceOf(xlaRSCFeeWaterfall.address)).to.be.equal(
      ethers.utils.parseEther("150000")
    );
    expect(await baseToken.balanceOf(addr1.address)).to.be.equal(
      ethers.utils.parseEther("350000")
    );
  });

  it("Should work with creation ID correctly", async () => {
    const XLARSCWaterfallCreationIdFactory = await ethers.getContractFactory(
      "XLARSCWaterfallFactory"
    );
    const xlaRSCWaterfallCreationIdFactory =
      await XLARSCWaterfallCreationIdFactory.deploy();
    await xlaRSCWaterfallCreationIdFactory.deployed();

    const EthPriceFeedMock = await ethers.getContractFactory(
      "EthPriceFeedMock"
    );
    const ethPriceFeedMock = await EthPriceFeedMock.deploy();
    await ethPriceFeedMock.deployed();

    await xlaRSCWaterfallCreationIdFactory.createRSCWaterfall({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      initialRecipients: [addr1.address, addr2.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
    });

    await expect(
      xlaRSCWaterfallCreationIdFactory.createRSCWaterfall({
        controller: owner.address,
        distributors: [owner.address],
        immutableController: false,
        autoNativeTokenDistribution: true,
        minAutoDistributeAmount: ethers.utils.parseEther("1"),
        initialRecipients: [addr1.address, addr2.address],
        maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
        priorities: [BigInt(10), BigInt(20)],
        supportedErc20addresses: [baseToken.address],
        erc20PriceFeeds: [ethPriceFeedMock.address],
        creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
      })
    ).to.be.revertedWithCustomError(
      xlaRSCWaterfallCreationIdFactory,
      "CreationIdAlreadyProcessed"
    );

    await xlaRSCWaterfallCreationIdFactory.createRSCWaterfall({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      initialRecipients: [addr1.address, addr2.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [ethPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-2"),
    });
  });

  it("Should recursively erc20 split", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, addr1.address],
      [ethers.utils.parseEther("10"), ethers.utils.parseEther("90")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await baseToken.transfer(
      rscWaterfallMain.address,
      ethers.utils.parseEther("1000000")
    );
    await baseToken.transfer(
      rscWaterfallSecond.address,
      ethers.utils.parseEther("1000000")
    );

    await rscWaterfallSecond.setDistributor(rscWaterfallMain.address, true);
    await rscWaterfallMain.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(rscWaterfallMain.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(rscWaterfallSecond.address)).to.be.equal(
      0
    );
  });

  it("Should recursively split ETH", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, addr1.address],
      [ethers.utils.parseEther("10"), ethers.utils.parseEther("50")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await owner.sendTransaction({
      to: rscWaterfallMain.address,
      value: ethers.utils.parseEther("50"),
    });

    expect(
      await ethers.provider.getBalance(rscWaterfallMain.address)
    ).to.be.equal(ethers.utils.parseEther("50"));

    await rscWaterfallSecond.setDistributor(rscWaterfallMain.address, true);
    await rscWaterfallMain.redistributeNativeToken();

    expect(
      await ethers.provider.getBalance(rscWaterfallMain.address)
    ).to.be.equal(0);
    expect(
      await ethers.provider.getBalance(rscWaterfallSecond.address)
    ).to.be.equal(0);
  });
});
