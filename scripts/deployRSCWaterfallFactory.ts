import { ethers } from "hardhat";

async function main() {

  const XLARSCWaterfallFactory = await ethers.getContractFactory("XLARSCWaterfallFactory");
  const xlaRSCWaterfallFactory = await XLARSCWaterfallFactory.deploy();
  await xlaRSCWaterfallFactory.deployed();

  console.log("X.LA RSC Waterfall factory deployed to: ", xlaRSCWaterfallFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
