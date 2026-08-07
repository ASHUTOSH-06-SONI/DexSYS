# Software Requirements Specification (SRS)

**Project Name:** DexSYS

**Version:** 1.0

**Authors:** Ashutosh Soni

**Course:** Software Engineering (23CCE302)

**Status:** Draft

**Last Updated:** August 2026

---
# 1. Introduction
## 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements for **DexSYS**, a hybrid decentralized exchange (DEX) platform.

The objective of this document is to establish a clear and complete understanding of the system requirements before implementation begins. It serves as the primary reference for system design, development, testing, deployment, and future maintenance throughout the software development lifecycle.

The document is intended to ensure that all stakeholders share a common understanding of the project's goals, scope, and expected functionality.


## 1.2 Scope

DexSYS is a hybrid decentralized exchange platform that enables secure peer-to-peer trading of blockchain-based digital assets.

The platform combines an off-chain high-performance trading engine with on-chain smart contract settlement to provide secure, transparent, and efficient cryptocurrency trading.

The system supports multiple trading mechanisms including:

- Order Book Trading
- Automated Market Maker (AMM) Token Swaps
- Liquidity Pool Management
- Wallet-based Authentication
- Portfolio Management
- Governance Mechanisms

The primary objective of the MVP is to demonstrate a production-inspired decentralized exchange architecture while following modern software engineering principles.

## 1.3 Objectives

The objectives of DexSYS are to:

- Enable secure decentralized digital asset trading.
- Maintain user custody of digital assets during trading.
- Provide low-latency off-chain order matching.
- Execute trustless on-chain trade settlement.
- Support both order book trading and AMM-based token swaps.
- Demonstrate modular and scalable software architecture.
- Serve as a comprehensive academic software engineering project following industry-standard development practices.

## 1.4 Intended Audience

This document is intended for:

- Project Developers
- Software Engineering Instructors
- Project Evaluators
- Future Contributors
- Test Engineers
- System Maintainers

## 1.5 Definitions

Key terminology used throughout this document is defined in the accompanying **Glossary** document located at: docs/01-requirements/glossary.md