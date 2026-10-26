---
name: Contract change
about: Propose a change to the device API, the USB protocol, the product model or the installer, or a new switch product.
title: "Contract: "
labels: [contract]
---

<!--
A contract change touches the console and every switch firmware: a device endpoint, a payload field,
an error code, a USB command or NVS key the console writes (HUESET, Improv), the installer, or a new product.
The contract lives in docs/device-api.md, docs/usb-protocol.md, docs/definitions.md and docs/round-pages.md.
Fill in what you can; the maintainer approves the issue before any code. Write in English.
-->

## Problem

What someone using a switch or the console cannot do today, and what they can do once this ships. One paragraph.

## Contract change

The exact change, as a diff to the contract docs: endpoints, request and response fields, error codes, USB commands, NVS keys. Mark each change **additive** or **breaking**.

Compatibility:

- Console with a board that has **not** updated:
- Board with a console that has **not** deployed (if firmware could ship first):
- Firmware versions that need the old path (`round < X.Y.Z`, `simple < X.Y.Z`):
- When the old path can be removed:

## Per-repo impact

Each repo ships its part in its own pull request; the console goes first and stays backward compatible.

### Console (`hue-switch-console`)

- Endpoint, UI or Setup change:
- Contract docs updated in the same commit:

### Round (`hue-round-switch`)

- Firmware change (`FIRMWARE_VERSION` bump, `CHANGELOG.md` entry), or "none":

### Simple (`hue-simple-switch`)

- Firmware change (`FIRMWARE_VERSION` bump, `CHANGELOG.md` entry), or "none":

## Acceptance

How we know it works, per repo: what to check on the console and on a board, including a board still on older firmware.

- [ ] 
