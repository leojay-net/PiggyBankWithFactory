import {ethers} from "hardhat";
import {AddressLike} from "ethers";


async function deploy() {
    const deployer = await ethers.provider.getSigner();
    console.log(`Deploying contracts with the account: ${deployer.address}`);


    const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    
    const tokenAddresses: [AddressLike, AddressLike, AddressLike] = [
        USDT, 
        USDC, 
        DAI
      ];

    const PiggyBankFactory = await ethers.deployContract("PiggyFactory", [tokenAddresses])
    await PiggyBankFactory.waitForDeployment()
    console.log(`Auction Swap deployed to: ${PiggyBankFactory.target}`);
  
    console.log("Deployment completed successfully");

    }


deploy().catch((error)=>{
    console.error(error)
    process.exit(1)
})

    
