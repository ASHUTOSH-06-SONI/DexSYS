// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISettlementVault {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
}

contract SettlementVaultReceiver {
    function depositInto(address vault) external payable {
        ISettlementVault(vault).deposit{value: msg.value}();
    }

    function withdrawFrom(address vault, uint256 amount) external {
        ISettlementVault(vault).withdraw(amount);
    }

    receive() external payable {}
}

contract RejectingSettlementVaultReceiver {
    function depositInto(address vault) external payable {
        ISettlementVault(vault).deposit{value: msg.value}();
    }

    function withdrawFrom(address vault, uint256 amount) external {
        ISettlementVault(vault).withdraw(amount);
    }

    receive() external payable {
        revert("Rejecting recipient");
    }
}
