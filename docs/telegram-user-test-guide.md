# TipSwap Telegram User Test Guide

This guide is for testing TipSwap directly inside Telegram.

The bot is:

```text
@tipswapbot
```

TipSwap uses real TON mainnet transactions. Use small amounts first, such as `0.02 TON`.

## What You Need

- Telegram installed.
- A small amount of TON for the sender wallet.
- Two Telegram accounts for full testing:
  - Sender account
  - Recipient account

You can test wallet setup and balance with one account, but tipping needs another registered recipient.

## 1. Start The Bot

Open Telegram and search:

```text
@tipswapbot
```

From both sender and recipient accounts, send:

```text
/start
```

Expected result:

- The bot replies with a TipSwap wallet address.
- The wallet is a managed TON wallet created for that Telegram account.

## 2. Check Your Wallet

From both accounts, send:

```text
/wallet
```

Expected result:

- The bot shows your active wallet address.
- The wallet mode should usually be `managed`.
- The bot shows your TON balance.

Then send:

```text
/balance
```

Expected result:

- The bot shows TON, USDT, and STON balances.

## 3. Fund The Sender Wallet

From the sender account, send:

```text
/wallet
```

Copy the wallet address shown by the bot.

Send a small amount of TON to that address from another wallet or exchange.

Recommended first test amount:

```text
0.1 TON
```

After sending TON, check:

```text
/balance
```

Expected result:

- The TON balance increases.

## 4. Test A Direct TON Tip

Make sure the recipient has already sent `/start` to `@tipswapbot`.

From the sender account, send:

```text
/tip 0.02 TON @recipientusername
```

Replace `@recipientusername` with the recipient's Telegram username.

Expected result:

- The bot shows a confirmation message.
- Tap **Confirm**.
- The sender gets a success or pending message.
- The recipient receives a Telegram message saying they received a tip.
- The recipient's wallet receives TON.

## 5. Test A Token Tip Using Site Syntax

This tests the simple syntax:

```text
/tip 1 USDT @recipientusername
```

This means:

- Sender pays from TON by default.
- Recipient receives USDT.
- TipSwap uses STON.fi to swap TON to USDT.

Expected result:

- The bot shows a quote and confirmation.
- Tap **Confirm**.
- The recipient receives USDT if the route executes successfully.

If this fails with a quote or liquidity message, try a smaller amount or test the direct TON tip first.

## 6. Test A Token Tip With Explicit Pay Token

From the sender account, send:

```text
/tip 1 USDT from TON @recipientusername
```

Expected result:

- Same behavior as `/tip 1 USDT @recipientusername`.
- The command confirms that the sender is paying from TON.

## 7. Test Multi-Recipient Tips

Each recipient must have already sent `/start` to `@tipswapbot`.

From the sender account, send:

```text
/tip 0.02 TON @userone @usertwo
```

You can test up to 3 recipients:

```text
/tip 0.02 TON @userone @usertwo @userthree
```

Expected result:

- The bot shows one confirmation message.
- Tap **Confirm**.
- Each recipient receives a separate tip.
- The sender sees a final sent/failed count.

TipSwap currently supports up to 3 recipients per tip command.

## 8. Test A Connected External Wallet

This tests receiving tips into your own wallet.

From the recipient account, send:

```text
/connect YOUR_TON_WALLET_ADDRESS
```

Example:

```text
/connect UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then check:

```text
/wallet
```

Expected result:

- The active wallet mode becomes `external`.
- Future tips to this user go to the connected external wallet.

Now from the sender account, tip that recipient:

```text
/tip 0.02 TON @recipientusername
```

Expected result:

- The recipient's external wallet receives the tip.

Important:

- External wallets can receive tips.
- External wallets cannot send bot-signed tips or swaps.
- To send tips again through TipSwap, switch back with:

```text
/managed
```

## 9. Test Tip Preferences

From any account, check settings:

```text
/settings
```

Set your default receive token:

```text
/receive USDT
```

Set your reaction tip default:

```text
/settip 0.02 TON from TON
```

Check again:

```text
/settings
```

Expected result:

- The bot shows the updated receive token.
- The bot shows the updated reaction tip amount and tokens.

## 10. Test Reaction Tipping In A Group

This needs a Telegram group.

Requirements:

- The bot `@tipswapbot` is added to the group.
- The bot can see messages in the group.
- The sender has already sent `/start` to the bot.
- The recipient has already sent `/start` to the bot.
- The recipient sends a message in the group after the bot has joined.

Then the sender reacts to the recipient's group message using one of:

```text
👍
❤
🔥
🎉
👏
```

Expected result:

- The bot sends the sender a private confirmation message.
- The sender taps **Confirm**.
- The recipient receives the reaction tip.

If nothing happens:

- The bot may not be allowed to see group messages.
- The message may have been sent before the bot joined.
- The sender or recipient may not have started the bot in private chat.

## 11. Check History

From any account, send:

```text
/history
```

Expected result:

- The bot shows recent swaps and tips.
- You can see whether recent actions were sent, failed, cancelled, or expired.

## 12. Useful Commands

```text
/start
/wallet
/balance
/tip 0.02 TON @recipientusername
/tip 1 USDT @recipientusername
/tip 1 USDT from TON @recipientusername
/receive USDT
/settip 0.02 TON from TON
/settings
/history
/connect YOUR_TON_WALLET_ADDRESS
/managed
/help
```

## Common Problems

### Recipient not found

The recipient must open `@tipswapbot` and send:

```text
/start
```

### Active wallet is external

External wallets can receive tips, but cannot send bot-signed tips or swaps.

Run:

```text
/managed
```

### STON.fi quote failed

Try:

```text
/tip 0.02 TON @recipientusername
```

Then retry token tips with a smaller amount.

### Reaction tip did not trigger

Check that:

- The bot is in the group.
- The group message was sent after the bot joined.
- Both users have started the bot privately.
- The reaction is one of the supported reactions.

### Tip is pending

Wait a minute, then check:

```text
/balance
/history
```
