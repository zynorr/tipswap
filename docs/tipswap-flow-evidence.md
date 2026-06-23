# TipSwap Flow Evidence

This document records the tested Mini App flow for a claim-link tip where the sender creates a tip for a receiver, the receiver opens the claim flow, and both sides see confirmed activity after the transaction completes.

Evidence captured on June 23, 2026.

## Flow Covered

- Sender account: `@maadg11`
- Receiver account: `@GriffinsOduol`
- Network: TON Mainnet
- Tip tested: `0.1 TON`
- Wallet mode shown in the sender flow: managed TipSwap wallet
- Final state shown in both accounts: confirmed on-chain with transaction hash and explorer link

## Sender Evidence

### 1. Sender Creates A Tip For A Receiver Who Needs To Claim

The sender enters the receiver username, amount, receive token, and pay token. The Mini App detects that the receiver needs to claim first and generates a claim link with a one-tap **Share to Telegram** action.

![Sender send screen](assets/tipswap-flow/sender-send-screen.png)

What this proves:

- The sender can start the tip from the Mini App.
- TipSwap recognizes when a receiver needs the claim-link flow.
- The Mini App creates a claim link instead of failing the send.
- The sender has a share action for delivering the claim link through Telegram.

### 2. Sender Sees Confirmed Activity After Completion

After the receiver prepares the claim and the sender confirms, the sender activity page shows the final `Tip sent` record as `Confirmed`, including a transaction hash and explorer button. The earlier claim-link record remains visible as the setup step.

![Sender activity screen](assets/tipswap-flow/sender-activity-screen.png)

What this proves:

- The sender gets a clear final status.
- Activity distinguishes the completed tip from the original claim-link setup item.
- The confirmed item includes on-chain evidence through the transaction hash and explorer link.

## Receiver Evidence

### 3. Receiver Opens Claim And Prepares It For Sender Confirmation

The receiver opens the Mini App claim screen. The app shows that the claim is ready and that the sender has been sent confirm/cancel buttons in Telegram.

![Receiver claim screen](assets/tipswap-flow/receiver-claim-screen.jpeg)

What this proves:

- The receiver can open the claim flow from the Mini App.
- The receiver can prepare the claim using their TipSwap wallet.
- Funds do not move silently; the sender must still confirm before completion.

### 4. Receiver Wallet Updates After Sender Confirmation

After the sender confirms, the receiver home screen shows `Tip received: 0.1 TON` and the managed TipSwap wallet balance reflects the received `0.1 TON`.

![Receiver home screen](assets/tipswap-flow/receiver-home-screen.jpeg)

What this proves:

- The receiver gets a success message after the sender confirms.
- The receiver wallet balance updates in the Mini App.
- The received token and amount match the test tip.

### 5. Receiver Activity Shows Confirmed On-Chain Result

The receiver activity page shows `Tip received` as `Confirmed`, includes the route `TON direct`, shows the receiver address, includes a transaction hash, and provides an explorer button.

![Receiver activity screen](assets/tipswap-flow/receiver-activity-screen.jpeg)

What this proves:

- The receiver gets a persistent activity record.
- The activity page clearly shows the transaction went through.
- The record includes on-chain verification data.

## Result

The captured screens demonstrate that the claim-link tip flow works end to end:

1. Sender creates a tip for a receiver who needs to claim.
2. TipSwap generates a claim link and Telegram share action.
3. Receiver opens the claim in the Mini App and prepares it.
4. Sender confirms the prepared claim.
5. Receiver wallet balance updates.
6. Sender and receiver activity pages show confirmed on-chain status with transaction evidence.

