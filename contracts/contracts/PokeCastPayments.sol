// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PokéCast payments
/// @notice Settles every PokéCast checkout in USDT (BEP-20). The backend prices each
/// checkout and signs it as an EIP-712 `Payment`; the payer submits it here and the
/// USDT moves straight from the payer to its destination. The contract never holds funds.
///  - packs and shipping: everything goes to the treasury (`payee == address(0)`)
///  - marketplace sales: `amount - fee` goes to the seller, `fee` to the treasury
contract PokeCastPayments is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant KIND_PACK = 0;
    uint8 public constant KIND_LISTING = 1;
    uint8 public constant KIND_SHIPPING = 2;

    struct Payment {
        bytes32 id; // unique checkout id, single use
        address payer;
        uint8 kind;
        bytes32 ref; // pack set id / listing id / shipment id
        uint32 quantity;
        uint256 amount; // total USDT (18 decimals on BSC)
        address payee; // address(0) = treasury
        uint256 fee; // part of amount that goes to the treasury
        uint64 deadline;
    }

    bytes32 public constant PAYMENT_TYPEHASH = keccak256(
        "Payment(bytes32 id,address payer,uint8 kind,bytes32 ref,uint32 quantity,uint256 amount,address payee,uint256 fee,uint64 deadline)"
    );

    IERC20 public immutable usdt;
    address public treasury;
    address public signer;
    mapping(bytes32 => bool) public used;

    event Paid(
        bytes32 indexed id,
        address indexed payer,
        uint8 indexed kind,
        bytes32 ref,
        uint32 quantity,
        uint256 amount,
        address payee,
        uint256 fee
    );
    event TreasuryChanged(address treasury);
    event SignerChanged(address signer);

    error NotPayer();
    error Expired();
    error AlreadyUsed();
    error BadFee();
    error BadSignature();
    error ZeroAddress();

    constructor(IERC20 usdt_, address treasury_, address signer_, address owner_)
        EIP712("PokeCast", "1")
        Ownable(owner_)
    {
        if (address(usdt_) == address(0) || treasury_ == address(0) || signer_ == address(0)) revert ZeroAddress();
        usdt = usdt_;
        treasury = treasury_;
        signer = signer_;
    }

    function hashPayment(Payment calldata p) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PAYMENT_TYPEHASH, p.id, p.payer, p.kind, p.ref, p.quantity, p.amount, p.payee, p.fee, p.deadline
                )
            )
        );
    }

    /// @notice Pays a signed checkout. The payer must have approved `amount` USDT to this contract.
    function pay(Payment calldata p, bytes calldata signature) external nonReentrant whenNotPaused {
        if (msg.sender != p.payer) revert NotPayer();
        if (block.timestamp > p.deadline) revert Expired();
        if (used[p.id]) revert AlreadyUsed();
        if (p.fee > p.amount) revert BadFee();
        if (ECDSA.recover(hashPayment(p), signature) != signer) revert BadSignature();

        used[p.id] = true;
        address payee = p.payee == address(0) ? treasury : p.payee;
        uint256 net = p.amount - p.fee;
        if (net > 0) usdt.safeTransferFrom(msg.sender, payee, net);
        if (p.fee > 0) usdt.safeTransferFrom(msg.sender, treasury, p.fee);

        emit Paid(p.id, p.payer, p.kind, p.ref, p.quantity, p.amount, payee, p.fee);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    /// @notice Rotate the backend signing key (e.g. if it is ever exposed).
    function setSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        signer = signer_;
        emit SignerChanged(signer_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
