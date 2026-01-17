# NestJS Browser Info Logger

---

## 🚀 Overview

This is a minimal **NestJS** application designed to capture and log information about a user's visit.

When accessed (via an HTTP request), the application performs two primary functions:

1.  It immediately **displays information** gathered from the user's browser (e.g., user agent, IP address, etc.) back to the user.
2.  It **saves a record of the visit** to the connected **MongoDB** database, logging details for later analysis.

## 🛠️ Technologies

* [**NestJS**](https://nestjs.com/) (Framework)
* [**Node.js**](https://nodejs.org/) (Runtime)
* **Database:** **MongoDB** (NoSQL)
