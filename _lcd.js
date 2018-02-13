pragma solidity ^0.4.17;

contract ERC20 {
  uint public totalSupply;
  function balanceOf(address who) constant returns (uint);
  function allowance(address owner, address spender) constant returns (uint);

  function transfer(address to, uint value) returns (bool ok);
  function transferFrom(address from, address to, uint value) returns (bool ok);
  function approve(address spender, uint value) returns (bool ok);
  event Transfer(address indexed from, address indexed to, uint value);
  event Approval(address indexed owner, address indexed spender, uint value);
}

/**
 * Math operations with safety checks
 */
contract SafeMath {
  function safeMul(uint a, uint b) internal returns (uint) {
    uint c = a * b;
    assert(a == 0 || c / a == b);
    return c;
  }

  function safeDiv(uint a, uint b) internal returns (uint) {
    assert(b > 0);
    uint c = a / b;
    assert(a == b * c + a % b);
    return c;
  }

  function safeSub(uint a, uint b) internal returns (uint) {
    assert(b <= a);
    return a - b;
  }

  function safeAdd(uint a, uint b) internal returns (uint) {
    uint c = a + b;
    assert(c>=a && c>=b);
    return c;
  }

  function max64(uint64 a, uint64 b) internal constant returns (uint64) {
    return a >= b ? a : b;
  }

  function min64(uint64 a, uint64 b) internal constant returns (uint64) {
    return a < b ? a : b;
  }

  function max256(uint256 a, uint256 b) internal constant returns (uint256) {
    return a >= b ? a : b;
  }

  function min256(uint256 a, uint256 b) internal constant returns (uint256) {
    return a < b ? a : b;
  }

}

contract StandardToken is ERC20, SafeMath {

  /* Token supply got increased and a new owner received these tokens */
  event Minted(address receiver, uint amount);

  /* Actual balances of token holders */
  mapping(address => uint) balances;

  /* approve() allowances */
  mapping (address => mapping (address => uint)) allowed;

  /* Interface declaration */
  function isToken() public constant returns (bool weAre) {
    return true;
  }

  function transfer(address _to, uint _value) returns (bool success) {
    balances[msg.sender] = safeSub(balances[msg.sender], _value);
    balances[_to] = safeAdd(balances[_to], _value);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  function transferFrom(address _from, address _to, uint _value) returns (bool success) {
    uint _allowance = allowed[_from][msg.sender];

    balances[_to] = safeAdd(balances[_to], _value);
    balances[_from] = safeSub(balances[_from], _value);
    allowed[_from][msg.sender] = safeSub(_allowance, _value);
    Transfer(_from, _to, _value);
    return true;
  }

  function balanceOf(address _owner) constant returns (uint balance) {
    return balances[_owner];
  }

  function approve(address _spender, uint _value) returns (bool success) {

    // To change the approve amount you first have to reduce the addresses`
    //  allowance to zero by calling `approve(_spender, 0)` if it is not
    //  already 0 to mitigate the race condition described here:
    //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    require((_value == 0) || (allowed[msg.sender][_spender] == 0));

    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  function allowance(address _owner, address _spender) constant returns (uint remaining) {
    return allowed[_owner][_spender];
  }

}

contract LCDToken is StandardToken {

    string public name = "LCD Token";
    string public symbol = "LCD";
    uint public decimals = 0;

    /**
     * Boolean contract states
     */
    bool public halted = false; //Founder can set this to true to halt the whole ICO event due to emergency
    bool public preIcoContinued = false; //PreICO can be continued manually even after the PreICO time has ended
    bool public preIco = true; //PreICO stage
    bool public stageIco = false; //ICO stage
    bool public stageDiscount = false; //Discount 40 % Stage
    bool public freeze = false; //Freeze state

    /**
     * Initial founder address (set in constructor)
     * All deposited ETH will be forwarded to this address.
     * Address is a multisig wallet.
     */
    address public founder = 0x0;
    address public owner = 0x0;

    /**
     * Token count
     */
    uint public totalTokens = 100000000;// Total supply is 100 million tokens
    uint public team = 50000000;// 50 million tokens are reserved for project owners and don't participate in sale

    /**
     * PreICO end time
     */    
     uint256 public preIcoEndTime = 1509433200; // PreICO end time is 10/31/2017 @ 7:00am (UTC)
    
    /**
     * PreICO and ICO cap
     */
    uint public preIcoCap = 25000000; // 25 million tokens for PreICO
    uint public IcoCap = 25000000; // 25 million tokens for ICO

    /**
     * Statistic values
     */
    uint public preIcoTokenSupply = 0; // This will keep track of the token supply created during the PreICO
    uint public IcoTokenSupply = 0; // This will keep track of the token supply created during the ICO event
    uint public totalEtherRaised = 0; // This will keep track of the Ether raised during the ICO event

    event Buy(address indexed sender, uint eth, uint fbt);

    /* This generates a public event on the blockchain that will notify clients */
    event TokensSent(address indexed to, uint256 value);
    event ContributionReceived(address indexed to, uint256 value);
    event Burn(address indexed from, uint256 value);

    function LCDToken(address _founder) payable {
        owner = msg.sender;
        founder = _founder;

        // Move team token pool to founder balance
        balances[founder] = team;
        // Sub from total tokens team pool
        totalTokens = safeSub(totalTokens, team);
        // Total supply is 100000000 (100 million) tokens
        totalSupply = totalTokens;
        balances[owner] = totalSupply;
    }

    /**
     * 1 LCD = 781250000000000 WEI
     * Price is 1280 LCD for 1 ETH
     */
    function price() constant returns (uint) {
        return 781250000000000 wei;
    }

    /**
      * The basic entry point to participate the ICO event process.
      *
      * Pay for funding, get invested tokens back in the sender address.
      */
    function buy() public payable returns(bool) {
        // Buy allowed if contract is not on halt
        require(!halted);
        // Amount of wei should be more that 0
        require(msg.value>0);

        // Count expected tokens price
        uint tokens = msg.value / price();

        // Total tokens should be more than user want's to buy
        require(balances[owner]>tokens);
		
        // Give 40% discount if Stage Discount is activated (60 because it is a math formula, the discount will be 40%!)
        if (stageDiscount) {
			preIco = false;
			stageIco = false;
            tokens = safeMul(tokens,100);
            tokens = safeDiv(tokens,60);
        }
		
        // Stage ICO - no bonus
        if (stageIco) {
			preIco = false;
        }
		
        // Give 40% discount on PreICO (60 because it is a math formula, the discount will be 40%!)
        if (preIco) {
        // Make sure that PreICO end time hasn't yet come or PreICO was manually continued
        if (now < preIcoEndTime || preIcoContinued){
           tokens = safeMul(tokens,100);
           tokens = safeDiv(tokens,60);
        } else {
            preIco = false;
        }       
            
        }

        // Check how much tokens are already sold
        if (preIco) {
            // Check that required tokens count are less than tokens already sold on PreICO
            require(safeAdd(preIcoTokenSupply, tokens) < preIcoCap);
        } else {
            // Check that required tokens count are less than tokens already sold on (ICO minus PreICO)
            require(safeAdd(IcoTokenSupply, tokens) < IcoCap);
        }

        // Send wei to founder address
        founder.transfer(msg.value);

        // Add tokens to user balance and remove from totalSupply
        balances[msg.sender] = safeAdd(balances[msg.sender], tokens);
        // Remove sold tokens from total supply count
        balances[owner] = safeSub(balances[owner], tokens);

        // Update stats
        if (preIco) {
            preIcoTokenSupply  = safeAdd(preIcoTokenSupply, tokens);
        } else {
           IcoTokenSupply = safeAdd(IcoTokenSupply, tokens); 
        }
        totalEtherRaised = safeAdd(totalEtherRaised, msg.value);

        // Send buy LCD token action
        Buy(msg.sender, msg.value, tokens);

        // /* Emit log events */
        TokensSent(msg.sender, tokens);
        ContributionReceived(msg.sender, msg.value);
        Transfer(owner, msg.sender, tokens);

        return true;
    }

    /**
     * PreICO state.
     */
    function PreIcoEnable() onlyOwner() {
        preIco = true;
    }

    function PreIcoDisable() onlyOwner() {
        preIco = false;
    }
    
    /**
     * PreICO continue even if PreICO time ran out
     */
    function PreIcoContinue() onlyOwner() {
        preIcoContinued = true;
    }

    function PreIcoUnContinue() onlyOwner() {
        preIcoContinued = false;
    }
	
    /**
     * Bonus Stage Discount state.
     */
    function StageDiscountEnable() onlyOwner() {
        stageDiscount = true;
    }

    function StageDiscountDisable() onlyOwner() {
        stageDiscount = false;
    }

    /**
     * Emergency stop whole ICO event
     */
    function EventEmergencyStop() onlyOwner() {
        halted = true;
    }

    function EventEmergencyContinue() onlyOwner() {
        halted = false;
    }

    /**
     * Transfer team tokens to target address
     */
    function sendTeamTokens(address _to, uint256 _value) onlyOwner() {
        balances[founder] = safeSub(balances[founder], _value);
        balances[_to] = safeAdd(balances[_to], _value);
        // /* Emit log events */
        TokensSent(_to, _value);
        Transfer(owner, _to, _value);
    }

    /**
     * Transfer owner tokens to target address
     */
    function sendSupplyTokens(address _to, uint256 _value) onlyOwner() {
        balances[owner] = safeSub(balances[owner], _value);
        balances[_to] = safeAdd(balances[_to], _value);
        // /* Emit log events */
        TokensSent(_to, _value);
        Transfer(owner, _to, _value);
    }

    /**
     * ERC 20 Standard Token interface transfer function
     *
     * Prevent transfers until halt period is over.
     */
    function transfer(address _to, uint256 _value) isAvailable() returns (bool success) {
        return super.transfer(_to, _value);
    }
    /**
     * ERC 20 Standard Token interface transfer function
     *
     * Prevent transfers until halt period is over.
     */
    function transferFrom(address _from, address _to, uint256 _value) isAvailable() returns (bool success) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
     * Burn all tokens from a balance.
     */
    function burnRemainingTokens() isAvailable() onlyOwner() {
        Burn(owner, balances[owner]);
        balances[owner] = 0;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier isAvailable() {
        require(!halted && !freeze);
        _;
    }

    /**
     * Received transaction - execute buy tokens action
     */
    function() payable {
        buy();
    }

    /**
     * Freeze and unfreeze ICO.
     */
    function freeze() onlyOwner() {
         freeze = true;
    }

     function unFreeze() onlyOwner() {
         freeze = false;
     }

    /**
     * Replaces an owner
     */
    function changeOwner(address _to) onlyOwner() {
        balances[_to] = balances[owner];
        balances[owner] = 0;
        owner = _to;
    }

    /**
     * Replaces a founder, transfer team pool to new founder balance
     */
    function changeFounder(address _to) onlyOwner() {
        balances[_to] = balances[founder];
        balances[founder] = 0;
        founder = _to;
    }
}
