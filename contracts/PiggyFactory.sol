// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./Piggy.sol";
import "./errors.sol";

contract PiggyFactory is Ownable {

    using Strings for uint256;

    struct BankDetails {
        string piggyPurpose;
        address piggyAddress;
    }
    uint256 totalPiggyBankCount;
    mapping(address => BankDetails[]) public bankDetails;
    mapping(address => bool) isWithdrawn;

    address[3] public supportedTokens;

    
    event PiggyBankCreated(address indexed owner, address piggyBankAddress, string purpose, uint256 endTime);
    event SavingAdded(address indexed owner, address indexed piggyBankAddress, address tokenAddress, uint256 amount);
    event PiggyBankWithdrawn(address indexed owner, address indexed piggyBankAddress);
    event EmergencyWithdrawal(address indexed owner, address indexed piggyBankAddress, address[] tokenAddresses);
    event SupportedTokensUpdated(address[3] newSupportedTokens);
    event FactoryBalanceWithdrawn(address tokenAddress, address to, uint256 amount);

    constructor(address[3] memory _supportedTokens) Ownable(msg.sender) {
        supportedTokens = _supportedTokens;
    }

    modifier withdrawn(address _saver){
        require(!isWithdrawn[_saver], "Already withdrawn");
        _;
    }

    function createPiggyBank(string memory _purpose, uint256 _endTime) public {
        if(bytes(_purpose).length == 0) revert INVALID_PURPOSE();
        if(_endTime < block.timestamp) revert INVALID_DEADLINE();
        
        bytes memory bytecode = abi.encodePacked(type(Piggy).creationCode, abi.encode(_purpose, _endTime, msg.sender));
        uint256 salt = uint256(keccak256(abi.encodePacked(_purpose, totalPiggyBankCount.toString())));

        address piggyBankAddress;
        assembly {
            piggyBankAddress := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        
        if(piggyBankAddress == address(0)) revert CREATION_FAILED();

        bankDetails[msg.sender].push(BankDetails({
            piggyPurpose: _purpose,
            piggyAddress: piggyBankAddress
        }));
        
        
        totalPiggyBankCount++;
        
        emit PiggyBankCreated(msg.sender, piggyBankAddress, _purpose, _endTime);
    }

    function savePiggyBank(address _piggyBankAddress, address _tokenAddress, uint256 _value) public withdrawn(msg.sender) {
        if(_piggyBankAddress == address(0)) revert INVALID_ADDRESS();
        if(_tokenAddress == address(0)) revert INVALID_ADDRESS();
        if(_value == 0) revert INVALID_AMOUNT();

        IERC20 token = IERC20(_tokenAddress);
        if(token.balanceOf(msg.sender) < _value) revert INVALID_BALANCE();
        if(token.allowance(msg.sender, address(this)) < _value) revert INVALID_ALLOWANCE();

        token.transferFrom(msg.sender, _piggyBankAddress, _value);
        Piggy piggy = Piggy(_piggyBankAddress);
        piggy._save(_tokenAddress, _value);
        
        emit SavingAdded(msg.sender, _piggyBankAddress, _tokenAddress, _value);
    }
    
    function withdrawPiggyBank(address _piggyBankAddress) public withdrawn(msg.sender) {
        if(_piggyBankAddress == address(0)) revert INVALID_ADDRESS();
        
        bool found = false;
        for(uint256 i = 0; i < bankDetails[msg.sender].length; i++) {
            if(bankDetails[msg.sender][i].piggyAddress == _piggyBankAddress) {
                found = true;
                Piggy piggy = Piggy(_piggyBankAddress);
                piggy._withdraw(supportedTokens, msg.sender);
                emit PiggyBankWithdrawn(msg.sender, _piggyBankAddress);
                break;
            }
        }
        
        if(!found) revert UNAUTHORIZED();

        isWithdrawn[msg.sender] = true;
    }

    function emergencyWithdrawPiggyBank(address _piggyBankAddress, address[] memory _tokenAddresses) public {
        if(_piggyBankAddress == address(0)) revert INVALID_ADDRESS();
        
        
        for(uint8 i = 0; i < supportedTokens.length; i++) {
            for(uint256 j = 0; j < _tokenAddresses.length; j++) {
                if(supportedTokens[i] == _tokenAddresses[j]) {
                    revert INVALID_ADDRESS();
                }
            }
        }
        
        
        bool found = false;
        for(uint256 i = 0; i < bankDetails[msg.sender].length; i++) {
            if(bankDetails[msg.sender][i].piggyAddress == _piggyBankAddress) {
                found = true;
                break;
            }
        }
        
        if(!found) revert UNAUTHORIZED();
        
        Piggy piggy = Piggy(_piggyBankAddress);
        piggy._emergencyWithdraw(_tokenAddresses);
        
        emit EmergencyWithdrawal(msg.sender, _piggyBankAddress, _tokenAddresses);
    }

    function getPiggyBankDetails(address _owner) public view returns(BankDetails[] memory) {
        return bankDetails[_owner];
    }

    function getSupportedTokens() public view returns(address[3] memory) {
        return supportedTokens;
    }

    function setSupportedTokens(address[3] memory _supportedTokens) public onlyOwner {
        supportedTokens = _supportedTokens;
        emit SupportedTokensUpdated(_supportedTokens);
    }

    function getFactoryBalance(address _tokenAddress) public view returns(uint256) {
        IERC20 token = IERC20(_tokenAddress);
        return token.balanceOf(address(this));
    }

    function withdrawFactoryBalance(address _tokenAddress, address _to, uint256 _value) public onlyOwner {
        if(_tokenAddress == address(0)) revert INVALID_ADDRESS();
        if(_to == address(0)) revert INVALID_ADDRESS();
        if(_value == 0) revert INVALID_AMOUNT();
        
        IERC20 token = IERC20(_tokenAddress);
        token.transfer(_to, _value);
        
        emit FactoryBalanceWithdrawn(_tokenAddress, _to, _value);
    }

    function getSavingsHistory(address _piggyBankAddress) public view returns(SaveDetails[] memory) {
        Piggy piggy = Piggy(_piggyBankAddress);
        return piggy._getSavingsHistory();
    }
}