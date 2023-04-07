import { expect } from "chai";
import { ethers } from "hardhat";
const { constants } = require("@openzeppelin/test-helpers");

async function deployRSCWaterfallUsdContract(
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
  const UsdPriceFeedMock = await ethers.getContractFactory("UsdPriceFeedMock");
  const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
  await usdPriceFeedMock.deployed();

  const XLARSCWaterfallFactory = await ethers.getContractFactory(
    "XLARSCWaterfallFactory"
  );
  const xlaRSCWaterfallFactory = await XLARSCWaterfallFactory.deploy();
  await xlaRSCWaterfallFactory.deployed();

  const tx = await xlaRSCWaterfallFactory.createRSCWaterfallUsd({
    controller: controller,
    distributors: distributors,
    immutableController: immutableController,
    autoNativeTokenDistribution: autoNativeTokenDistribution,
    nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
    minAutoDistributeAmount: minAutoDistributeAmount,
    initialRecipients: initialRecipients,
    maxCaps: maxCaps,
    priorities: priorities,
    supportedErc20addresses: supportedErc20addresses,
    erc20PriceFeeds: [usdPriceFeedMock.address],
    creationId: constants.ZERO_BYTES32,
  });

  let receipt = await tx.wait();
  const rscWaterfallContractAddress = receipt.events?.[5].args?.[0];

  const XLARSCWaterfall = await ethers.getContractFactory("XLARSCWaterfallUsd");
  const xlaRSCWaterfall = await XLARSCWaterfall.attach(
    rscWaterfallContractAddress
  );
  return xlaRSCWaterfall;
}

describe("XLA RSC Waterfall USD tests", function () {
  let xlaRSCWaterfallUsd: any;
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
    baseToken = await TestToken.deploy("BaseToken", "BTKN", 100000000000);
    await baseToken.deployed();

    testToken = await TestToken.deploy("TestToken", "TTT", 10000000000);
    await testToken.deployed();

    xlaRSCWaterfallUsd = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      true,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100000"), ethers.utils.parseEther("10000")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );
    await xlaRSCWaterfallUsd.deployed();
  });

  it("Should set base attrs correctly", async () => {
    // Contract settings
    expect(await xlaRSCWaterfallUsd.owner()).to.be.equal(owner.address);
    expect(await xlaRSCWaterfallUsd.distributors(owner.address)).to.be.true;
    expect(await xlaRSCWaterfallUsd.controller()).to.be.equal(owner.address);
    expect(await xlaRSCWaterfallUsd.numberOfRecipients()).to.be.equal(
      BigInt(1)
    );
    expect(await xlaRSCWaterfallUsd.platformFee()).to.be.equal(0);

    // Recipients settings
    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr2.address
    );
    expect(await xlaRSCWaterfallUsd.recipients(0)).to.be.equal(addr1.address);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100000"));
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).priority
    ).to.be.equal(10);

    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr2.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("10000"));
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr2.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr2.address)).priority
    ).to.be.equal(20);
  });

  it("Should add recipients correctly", async () => {
    await expect(
      xlaRSCWaterfallUsd
        .connect(addr3)
        .setRecipients([addr3.address], [2000], [BigInt(10)])
    ).to.be.revertedWithCustomError(xlaRSCWaterfallUsd, "OnlyControllerError");

    await xlaRSCWaterfallUsd.setRecipients(
      [addr1.address, addr3.address],
      [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
      [BigInt(30), BigInt(20)]
    );

    expect(await xlaRSCWaterfallUsd.numberOfRecipients()).to.be.equal(2);
    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr2.address
    );
    expect(await xlaRSCWaterfallUsd.recipients(0)).to.be.equal(addr1.address);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("100"));
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).priority
    ).to.be.equal(30);

    expect(await xlaRSCWaterfallUsd.recipients(1)).to.be.equal(addr3.address);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr3.address)).maxCap
    ).to.be.equal(ethers.utils.parseEther("50"));
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr3.address)).received
    ).to.be.equal(0);
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr3.address)).priority
    ).to.be.equal(20);

    await expect(
      xlaRSCWaterfallUsd.recipients(2)
    ).to.be.revertedWithoutReason();

    await expect(
      xlaRSCWaterfallUsd.setRecipients(
        [addr1.address, addr1.address],
        [ethers.utils.parseEther("100"), ethers.utils.parseEther("50")],
        [BigInt(30), BigInt(20)]
      )
    ).to.be.revertedWithCustomError(
      xlaRSCWaterfallUsd,
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
      to: xlaRSCWaterfallUsd.address,
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

    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr2.address
    );

    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr2.address)).received
    ).to.be.equal(ethers.utils.parseEther("5000"));

    // Second Buy
    // Send rest of max cap to addr2, should switch currentRecipient to addr1

    const txHashSecondBuy = await owner.sendTransaction({
      to: xlaRSCWaterfallUsd.address,
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

    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr1.address
    );
    await expect(xlaRSCWaterfallUsd.recipients(0)).to.revertedWithoutReason();
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).received
    ).to.be.equal(0);

    // "third Buy"
    // send 1/99 to addr1, should stay as current recipient

    const txHashThirdBuy = await owner.sendTransaction({
      to: xlaRSCWaterfallUsd.address,
      value: ethers.utils.parseEther("1"),
    });

    const addr1BalanceAfterThirdBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterThirdBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();

    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr1.address
    );
    expect(
      (await xlaRSCWaterfallUsd.recipientsData(addr1.address)).received
    ).to.be.equal(ethers.utils.parseEther("1000"));

    // Fourth buy
    // send rest to addr1 and 1 eth on top, currentRecipient should be ZERO_ADDRESS because there are no more recipients
    // contract should have balance of 1

    const txHashFourthBuy = await owner.sendTransaction({
      to: xlaRSCWaterfallUsd.address,
      value: ethers.utils.parseEther("100"),
    });

    const addr1BalanceAfterFourthBuy = (
      await ethers.provider.getBalance(addr1.address)
    ).toBigInt();
    const addr2BalanceAfterFourthBuy = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    const rscContractBalance = (
      await ethers.provider.getBalance(xlaRSCWaterfallUsd.address)
    ).toBigInt();

    expect(rscContractBalance).to.be.equal(ethers.utils.parseEther("1"));
    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      constants.ZERO_ADDRESS
    );
    await expect(xlaRSCWaterfallUsd.recipients(0)).to.revertedWithoutReason();

    // Fifth buy
    // Send 4 Eth to RSC, because there is no currentRecipient all eth will be send to contract

    const txHashFifthBuy = await owner.sendTransaction({
      to: xlaRSCWaterfallUsd.address,
      value: ethers.utils.parseEther("4"),
    });

    const rscContractBalanceEmptyBuy = (
      await ethers.provider.getBalance(xlaRSCWaterfallUsd.address)
    ).toBigInt();
    expect(rscContractBalanceEmptyBuy).to.be.equal(
      ethers.utils.parseEther("5")
    );

    // Sixth buy
    // Set new recipients and currentRecipient (addr3) should receive 5 eth from RSC contract
    await xlaRSCWaterfallUsd.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10000")],
      [BigInt(10)]
    );

    const addr3BalanceBefore = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    const txHashSixthBuy = await owner.sendTransaction({
      to: xlaRSCWaterfallUsd.address,
      value: ethers.utils.parseEther("5"),
    });

    const addr3BalanceAfter = (
      await ethers.provider.getBalance(addr3.address)
    ).toBigInt();

    expect(
      await ethers.provider.getBalance(xlaRSCWaterfallUsd.address)
    ).to.be.equal(0);
    expect(
      addr3BalanceBefore + ethers.utils.parseEther("10").toBigInt()
    ).to.be.equal(addr3BalanceAfter);
    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      constants.ZERO_ADDRESS
    );

    // Seventh buy
    // Set 3 recipients and 2 of them should be fulfilled in 1 TX
    await xlaRSCWaterfallUsd.setRecipients(
      [addr1.address, addr2.address, addr3.address],
      [
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("10000"),
        ethers.utils.parseEther("10000"),
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
      to: xlaRSCWaterfallUsd.address,
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

    expect(await xlaRSCWaterfallUsd.numberOfRecipients()).to.be.equal(0);
    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr3.address
    );
    expect(
      (await ethers.provider.getBalance(xlaRSCWaterfallUsd.address)).toBigInt()
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
      (await xlaRSCWaterfallUsd.recipientsData(addr3.address)).received
    ).to.be.equal(ethers.utils.parseEther("5000"));
  });

  it("Should redistribute ERC20 token", async () => {
    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    await baseToken.transfer(
      xlaRSCWaterfallUsd.address,
      ethers.utils.parseEther("10")
    );

    await xlaRSCWaterfallUsd.setTokenUsdPriceFeed(
      baseToken.address,
      usdPriceFeedMock.address
    );
    await xlaRSCWaterfallUsd.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(xlaRSCWaterfallUsd.address)).to.be.equal(
      0
    );
    expect(await baseToken.balanceOf(addr1.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(addr2.address)).to.be.equal(
      ethers.utils.parseEther("10")
    );
    expect(await xlaRSCWaterfallUsd.currentRecipient()).to.be.equal(
      addr1.address
    );
    expect(await xlaRSCWaterfallUsd.numberOfRecipients()).to.be.equal(0);

    await baseToken.transfer(
      xlaRSCWaterfallUsd.address,
      ethers.utils.parseEther("105")
    );
    await xlaRSCWaterfallUsd.redistributeToken(baseToken.address);
    expect(await baseToken.balanceOf(xlaRSCWaterfallUsd.address)).to.be.equal(
      ethers.utils.parseEther("5")
    );
    expect(await baseToken.balanceOf(addr1.address)).to.be.equal(
      ethers.utils.parseEther("100")
    );
    expect(await baseToken.balanceOf(addr2.address)).to.be.equal(
      ethers.utils.parseEther("10")
    );

    await xlaRSCWaterfallUsd.setRecipients(
      [addr3.address],
      [ethers.utils.parseEther("10000")],
      [BigInt(10)]
    );
    await testToken.transfer(
      xlaRSCWaterfallUsd.address,
      ethers.utils.parseEther("100")
    );
    await expect(
      xlaRSCWaterfallUsd.redistributeToken(testToken.address)
    ).to.be.revertedWithCustomError(
      xlaRSCWaterfallUsd,
      "TokenMissingUsdPriceOracle"
    );

    await expect(
      xlaRSCWaterfallUsd.connect(addr1).redistributeToken(baseToken.address)
    ).to.be.revertedWithCustomError(xlaRSCWaterfallUsd, "OnlyDistributorError");
  });

  it("Should initialize only once", async () => {
    await expect(
      xlaRSCWaterfallUsd.initialize(
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
        [BigInt(10)],
        addr1.address
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should transfer ownership correctly", async () => {
    await xlaRSCWaterfallUsd.transferOwnership(addr1.address);
    expect(await xlaRSCWaterfallUsd.owner()).to.be.equal(addr1.address);
  });

  it("Should deploy and create immutable contract", async () => {
    const rscWaterfallImmutable = await deployRSCWaterfallUsdContract(
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
    const rscWaterfallUsdManualDistribution =
      await deployRSCWaterfallUsdContract(
        owner.address,
        [owner.address],
        false,
        false,
        ethers.utils.parseEther("1"),
        [addr1.address, addr2.address],
        [ethers.utils.parseEther("100000"), ethers.utils.parseEther("50000")],
        [BigInt(10), BigInt(20)],
        [baseToken.address]
      );

    const transactionHash = await owner.sendTransaction({
      to: rscWaterfallUsdManualDistribution.address,
      value: ethers.utils.parseEther("5"),
    });

    const contractBalance = (
      await ethers.provider.getBalance(
        rscWaterfallUsdManualDistribution.address
      )
    ).toBigInt();
    expect(contractBalance).to.be.equal(ethers.utils.parseEther("5"));

    await expect(
      rscWaterfallUsdManualDistribution.connect(addr3).redistributeNativeToken()
    ).to.be.revertedWithCustomError(
      rscWaterfallUsdManualDistribution,
      "OnlyDistributorError"
    );

    const priorityRecipientBeforeBalance = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    await rscWaterfallUsdManualDistribution.redistributeNativeToken();

    const contractBalance2 = (
      await ethers.provider.getBalance(
        rscWaterfallUsdManualDistribution.address
      )
    ).toBigInt();
    expect(contractBalance2).to.be.equal(0);

    const priorityRecipientBalanceAfter = (
      await ethers.provider.getBalance(addr2.address)
    ).toBigInt();
    expect(priorityRecipientBalanceAfter).to.be.equal(
      priorityRecipientBeforeBalance + ethers.utils.parseEther("5").toBigInt()
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

    await rscWaterfallFeeFactory.setPlatformFee(BigInt(5000000));
    await rscWaterfallFeeFactory.setPlatformWallet(addr4.address);

    const platformWallet = addr4.address;
    expect(await rscWaterfallFeeFactory.platformWallet()).to.be.equal(
      platformWallet
    );
    expect(await rscWaterfallFeeFactory.platformFee()).to.be.equal(
      BigInt(5000000)
    );

    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    const txFee = await rscWaterfallFeeFactory.createRSCWaterfallUsd({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      initialRecipients: [addr1.address, addr2.address],
      maxCaps: [
        ethers.utils.parseEther("50000"),
        ethers.utils.parseEther("10000"),
      ],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: constants.ZERO_BYTES32,
    });

    let receipt = await txFee.wait();
    const revenueShareContractAddress = receipt.events?.[5].args?.[0];
    const XLARevenueShareContract = await ethers.getContractFactory(
      "XLARSCWaterfallUsd"
    );
    const xlaRSCFeeWaterfallUsd = await XLARevenueShareContract.attach(
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
      to: xlaRSCFeeWaterfallUsd.address,
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
      xlaRSCFeeWaterfallUsd.address,
      ethers.utils.parseEther("100")
    );

    await xlaRSCFeeWaterfallUsd.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(platformWallet)).to.be.equal(
      ethers.utils.parseEther("50")
    );
    expect(
      await baseToken.balanceOf(xlaRSCFeeWaterfallUsd.address)
    ).to.be.equal(ethers.utils.parseEther("15"));
    expect(await baseToken.balanceOf(addr1.address)).to.be.equal(
      ethers.utils.parseEther("35")
    );
  });

  it("Should work with creation ID correctly", async () => {
    const XLARSCWaterfallCreationIdFactory = await ethers.getContractFactory(
      "XLARSCWaterfallFactory"
    );
    const xlaRSCWaterfallCreationIdFactory =
      await XLARSCWaterfallCreationIdFactory.deploy();
    await xlaRSCWaterfallCreationIdFactory.deployed();

    const UsdPriceFeedMock = await ethers.getContractFactory(
      "UsdPriceFeedMock"
    );
    const usdPriceFeedMock = await UsdPriceFeedMock.deploy();
    await usdPriceFeedMock.deployed();

    await xlaRSCWaterfallCreationIdFactory.createRSCWaterfallUsd({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      initialRecipients: [addr1.address, addr2.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
    });

    await expect(
      xlaRSCWaterfallCreationIdFactory.createRSCWaterfallUsd({
        controller: owner.address,
        distributors: [owner.address],
        immutableController: false,
        autoNativeTokenDistribution: true,
        minAutoDistributeAmount: ethers.utils.parseEther("1"),
        nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
        initialRecipients: [addr1.address, addr2.address],
        maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
        priorities: [BigInt(10), BigInt(20)],
        supportedErc20addresses: [baseToken.address],
        erc20PriceFeeds: [usdPriceFeedMock.address],
        creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
      })
    ).to.be.revertedWithCustomError(
      xlaRSCWaterfallCreationIdFactory,
      "CreationIdAlreadyProcessed"
    );

    await xlaRSCWaterfallCreationIdFactory.createRSCWaterfallUsd({
      controller: owner.address,
      distributors: [owner.address],
      immutableController: false,
      autoNativeTokenDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      nativeTokenUsdPriceFeed: usdPriceFeedMock.address,
      initialRecipients: [addr1.address, addr2.address],
      maxCaps: [ethers.utils.parseEther("50"), ethers.utils.parseEther("10")],
      priorities: [BigInt(10), BigInt(20)],
      supportedErc20addresses: [baseToken.address],
      erc20PriceFeeds: [usdPriceFeedMock.address],
      creationId: ethers.utils.formatBytes32String("test-creation-id-2"),
    });
  });

  it("Should recursively erc20 split", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [ethers.utils.parseEther("100000"), ethers.utils.parseEther("50000")],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, addr1.address],
      [ethers.utils.parseEther("10000"), ethers.utils.parseEther("90000")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await baseToken.transfer(
      rscWaterfallMain.address,
      ethers.utils.parseEther("100")
    );
    await baseToken.transfer(
      rscWaterfallSecond.address,
      ethers.utils.parseEther("90")
    );

    await rscWaterfallSecond.setDistributor(rscWaterfallMain.address, true);
    await rscWaterfallMain.redistributeToken(baseToken.address);

    expect(await baseToken.balanceOf(rscWaterfallMain.address)).to.be.equal(0);
    expect(await baseToken.balanceOf(rscWaterfallSecond.address)).to.be.equal(
      0
    );
  });

  it("Should recursively split ETH", async () => {
    const rscWaterfallSecond = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [addr1.address, addr2.address],
      [
        ethers.utils.parseEther("100000000"),
        ethers.utils.parseEther("50000000"),
      ],
      [BigInt(10), BigInt(20)],
      [baseToken.address]
    );

    const rscWaterfallMain = await deployRSCWaterfallUsdContract(
      owner.address,
      [owner.address],
      false,
      false,
      ethers.utils.parseEther("1"),
      [rscWaterfallSecond.address, addr1.address],
      [ethers.utils.parseEther("10000"), ethers.utils.parseEther("50000")],
      [BigInt(20), BigInt(10)],
      [baseToken.address]
    );

    await owner.sendTransaction({
      to: rscWaterfallMain.address,
      value: ethers.utils.parseEther("60"),
    });
    await owner.sendTransaction({
      to: rscWaterfallSecond.address,
      value: ethers.utils.parseEther("50"),
    });

    expect(
      await ethers.provider.getBalance(rscWaterfallMain.address)
    ).to.be.equal(ethers.utils.parseEther("60"));

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
