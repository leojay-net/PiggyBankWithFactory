// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

contract ERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    address owner;
    
    mapping (address => uint256) public balances;
    mapping (address => mapping(address => uint256)) allowances;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    error INVALIDADDRESS();
    error INSUFFICIENTBALANCE();
    error UNAUTHORIZED();

    modifier onlyOwner() {
        if(msg.sender != owner) revert UNAUTHORIZED();
        _;
    }

    
    constructor (string memory _name, string memory _symbol, uint8 _decimals, uint256 _totalSupply) {
        owner = msg.sender;    
        name = _name;
        symbol = _symbol;
        decimals = _decimals;

        mint(msg.sender, _totalSupply);

        totalSupply = _totalSupply;

        
        }


    // function name() public view returns (string)
    // function symbol() public view returns (string)
    // function decimals() public view returns (uint8)
    // function totalSupply() public view returns (uint256)
    function balanceOf(address _owner) public view returns (uint256 balance) {
        if(_owner == address(0)) revert INVALIDADDRESS();
        balance = balances[_owner];
    }
    
    
    function transfer(address _to, uint256 _value) public returns (bool success) {
        if(msg.sender == address(0) && _to == address(0)) revert INVALIDADDRESS();
        if(balances[msg.sender] < _value) revert INSUFFICIENTBALANCE();
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        success = true;
    
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        if(_from == address(0) && _to == address(0)) revert INVALIDADDRESS();
        if(balances[_from] < _value) revert INSUFFICIENTBALANCE();
        if(allowances[_from][msg.sender] < _value) revert UNAUTHORIZED();

        balances[_from] -= _value;
        balances[_to] += _value;
        allowances[msg.sender][_from] -= _value;
        emit Transfer(_from, _to, _value);
        success = true;
    }

    function approve(address _spender, uint256 _value) public returns (bool success) {
        if(_spender == address(0) && msg.sender == address(0)) revert INVALIDADDRESS();
        if(balances[msg.sender] < _value) revert INSUFFICIENTBALANCE();
        
        allowances[msg.sender][_spender] = _value;
        success = true;
        emit Approval(msg.sender, _spender, _value);

    }
    
    function allowance(address _owner, address _spender) public view returns (uint256 remaining) {
        require(_spender != address(0) && _owner != address(0), "INVALID ADDRESS");

        remaining = allowances[_owner][_spender];

    }

    function mint(address _to, uint256 _value) public onlyOwner returns (bool success) {
        if(_to == address(0)) revert INVALIDADDRESS();
        totalSupply += _value;
        balances[_to] += _value;
        emit Transfer(address(0), _to, _value);
        success = true;
    }

    function burn(uint256 _value) public returns (bool success) {
        if(balances[msg.sender] < _value) revert INSUFFICIENTBALANCE();
      
        totalSupply -= balances[msg.sender];
        balances[msg.sender] -= _value;
        emit Transfer(msg.sender, address(0), balances[msg.sender]);

        success = true;
    }
    
    
}