# TipSwap Telegram User Test Guide

This guide is for testing TipSwap directly inside Telegram.

The bot is:

```text
@tipswapperbot
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
@tipswapperbot
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

For the fastest path, make sure the recipient has already sent `/start` to `@tipswapperbot`.

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

If the recipient has not started `@tipswapperbot`, the sender gets a claim link instead. Send that link to the recipient. When the recipient opens it, the bot registers them, prepares the quote, and asks the sender to confirm before any funds move.

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

## 6. Test An Unregistered Recipient Claim Link

From the sender account, tip a Telegram username that has not started `@tipswapperbot` yet:

```text
/tip 0.02 TON @newrecipientusername
```

Expected result:

- The sender receives a `https://t.me/tipswapperbot?start=claim_...` link.
- Send the link to `@newrecipientusername`.
- The recipient opens the link from the same Telegram username.
- If the sender also receives a Mini App link, the recipient can open it to choose a managed wallet, paste a TON address, or connect a TON Connect wallet.
- The sender receives a normal confirmation message.
- Tap **Confirm** from the sender account.
- The recipient receives the tip.

Claim links are for one unregistered recipient at a time. Multi-recipient tips still require every recipient to have started the bot first.

## 7. Test A Token Tip With Explicit Pay Token

From the sender account, send:

```text
/tip 1 USDT from TON @recipientusername
```

Expected result:

- Same behavior as `/tip 1 USDT @recipientusername`.
- The command confirms that the sender is paying from TON.

## 8. Test Multi-Recipient Tips

Each recipient must have already sent `/start` to `@tipswapperbot`.

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

## 9. Test A Connected External Wallet

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
- Telegram command sends are bot-signed, so they still require a managed wallet.
- To send from Telegram commands again, switch back with:

```text
/managed
```

## 10. Test Sending From An External Wallet In The Mini App

This tests the TON Connect path. The sender signs with their own wallet instead of using the managed wallet.

From the sender account:

1. Open the Mini App from the bot menu, `/start`, or `/help`.
2. Go to the wallet tab.
3. Tap the TON Connect button and connect the wallet you want to use.
4. Tap **Save connected wallet** if it appears.
5. Go to the send tab.
6. Enter recipient, amount, receive token, and pay token.
7. Tap **Quote**.
8. Tap **Sign and send** and approve in your wallet.

Expected result:

- Same-token sends, such as TON to TON or USDT to USDT, use TON Pay tracking.
- Cross-token sends, such as TON to USDT, use a STON.fi swap transaction.
- The recipient receives funds at their active TipSwap wallet address.

## 11. Test Tip Preferences

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

## 12. Test Reaction Tipping In A Group

This needs a Telegram group.

Requirements:

- The bot `@tipswapperbot` is added to the group.
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

## 13. Check History

From any account, send:

```text
/history
```

Expected result:

- The bot shows recent swaps and tips.
- You can see whether recent actions were sent, failed, cancelled, or expired.

## 14. Useful Commands

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

For a single-recipient `/tip`, the bot now returns a claim link if the Telegram username has not started `@tipswapperbot` yet. Send that link to the recipient.

For multi-recipient tips and reaction tips, the recipient must open `@tipswapperbot` and send:

```text
/start
```

### Active wallet is external

External wallets can receive tips. They can also send from the Mini App by signing with TON Connect.

Telegram command sends are still bot-signed. For command sends, run:

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
