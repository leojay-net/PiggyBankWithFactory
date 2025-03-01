// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./errors.sol";

struct SaveDetails {
    uint256 amount;
    uint256 saveTime;
    address tokenAddress;
}

contract Piggy is ReentrancyGuard {

    string public purpose;
    uint256 public endTime;

    address public owner;
    address public factory;

    uint8 public constant PENALTY_PERCENTAGE = 15;
    uint32 public constant SCALING_FACTOR = 1000;

    SaveDetails[] public savings;
    
    
    event Saved(address tokenAddress, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed owner, address[3] tokenAddresses, uint256 totalAmount);
    event EmergencyWithdrawn(address[] tokenAddresses, uint256 totalAmount);

    constructor (string memory _purpose, uint256 _endTime, address _owner) {
        purpose = _purpose;
        endTime = _endTime;
        owner = _owner;
        factory = msg.sender;
    }

    modifier onlyOwner(address _owner) {
        require(_owner == owner, "Only owner can call this function");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory can call this function");
        _;
    }   

    function _save(address _tokenAddress, uint256 _value) public onlyFactory {
        if(_tokenAddress == address(0)) revert INVALID_ADDRESS();
        if(_value == 0) revert INVALID_AMOUNT();

        SaveDetails memory saveDetails = SaveDetails({
            amount: _value,
            saveTime: block.timestamp,
            tokenAddress: _tokenAddress
        });

        savings.push(saveDetails);
        
        emit Saved(_tokenAddress, _value, block.timestamp);
    }

    function _withdraw(address[3] memory _tokenAddresses, address _owner) public onlyOwner(_owner) onlyFactory nonReentrant {
        if(block.timestamp < endTime) revert DEADLINE_NOT_REACHED();
        
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < _tokenAddresses.length; i++) {
            if(_tokenAddresses[i] == address(0)) continue;
            
            IERC20 token = IERC20(_tokenAddresses[i]);
            uint256 balance = token.balanceOf(address(this));
            
            if (balance > 0) {
                (uint256 fee, uint256 amount) = _calculateFee(balance);
                
                
                bool ownerTransferSuccess = token.transfer(owner, amount);
                if(!ownerTransferSuccess) revert TRANSFER_FAILED();
                
                
                bool feeTransferSuccess = token.transfer(msg.sender, fee);
                if(!feeTransferSuccess) revert TRANSFER_FAILED();
                
                totalAmount += amount;
            }
        }
        
        emit Withdrawn(_owner, _tokenAddresses, totalAmount);
    }

    function _emergencyWithdraw(address[] memory _tokenAddresses) public onlyFactory nonReentrant {
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < _tokenAddresses.length; i++) {
            if(_tokenAddresses[i] == address(0)) continue;
            
            IERC20 token = IERC20(_tokenAddresses[i]);
            uint256 balance = token.balanceOf(address(this));
            
            if (balance > 0) {
                bool success = token.transfer(owner, balance);
                if(!success) revert TRANSFER_FAILED();
                
                totalAmount += balance;
            }
        }
        
        emit EmergencyWithdrawn(_tokenAddresses, totalAmount);
    }

    function _calculateFee(uint256 _value) public pure returns (uint256, uint256) {
        uint256 numerator = _value * PENALTY_PERCENTAGE * SCALING_FACTOR;
        uint256 denominator = 100 * SCALING_FACTOR;
        uint256 fee = numerator / denominator;
        uint256 amount = _value - fee;
        return (fee, amount);
    }

    function _getSavingsHistory() public view returns (SaveDetails[] memory) {
        return savings;
    }
}