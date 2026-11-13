# Month 1 Daily Coding Plan (18 Nov – 20 Dec 2026)

What to learn each day of Month 1: learn in the 7:00–8:30 am slot, practise in your work hour, and use Saturday's 3-hour block for the mini-project.

## Week 1 (18–22 Nov): Setup, Git, Python core

By Sunday your laptop is ready for development and your first Python project is on GitHub.

| Date | Focus | Morning: learn (7:00–8:30) | Work hour: practise | Resources |
| --- | --- | --- | --- | --- |
| Wed 18 Nov | Tools setup | Install VS Code, Python 3.12 (tick "Add to PATH"), Git for Windows, Windows Terminal; create a GitHub account; set Git name and email; add an SSH key | Git basics: `init`, `add`, `commit`, `push`; create the `learning-journey` repo | Git official docs; GitHub Docs |
| Thu 19 Nov | WSL + Git branching | Install WSL2 with `wsl --install`; branches, `merge`, merge conflicts, pull requests on your own repo | First levels of Learn Git Branching | learngitbranching.js.org |
| Fri 20 Nov | Python core | Strings, lists, tuples, dicts, sets; functions, default and keyword arguments; list and dict comprehensions | 5 Python exercises | Official Python tutorial; Exercism; HackerRank |
| Sat 21 Nov (3 hrs) | Python + mini-project | Error handling (`try`/`except`), reading and writing files, modules, virtual environments and `pip`. Then build a command-line program that reads a CSV of stock prices and prints averages, highs and lows | — | Python `csv` module docs |
| Sun 22 Nov | Review | Catch up on anything unfinished; rewrite notes in your own words | — | Your `notes.md` |

## Week 2 (23–29 Nov): OOP and data structures

By Sunday you can explain the four OOP pillars and solve basic LeetCode easy problems.

| Date | Focus | Morning: learn (7:00–8:30) | Work hour: practise | Resources |
| --- | --- | --- | --- | --- |
| Mon 23 Nov | Classes and objects | Classes, objects, `__init__`, `self`, instance vs class attributes, methods | 1 LeetCode easy: arrays | Official Python tutorial (Classes); LeetCode |
| Tue 24 Nov | OOP pillars | Encapsulation, inheritance, polymorphism, abstraction; write your own example of each | 1 LeetCode easy: strings | LeetCode |
| Wed 25 Nov | Advanced Python OOP | Special methods (`__str__`, `__eq__`, `__len__`), dataclasses, custom exceptions | 1 LeetCode easy: hash maps | Python `dataclasses` docs |
| Thu 26 Nov | Complexity + structures | Big-O notation; when to use a list, dict or set; stacks and queues | 1 LeetCode easy: stacks | LeetCode |
| Fri 27 Nov | Algorithms basics | Recursion, built-in sorting, binary search | 1 LeetCode easy: binary search | LeetCode |
| Sat 28 Nov (3 hrs) | Mini-project | Rebuild the Week 1 program using classes; fetch data from a public API with `requests`; save results as JSON; write a README | — | `requests` docs |
| Sun 29 Nov | Review | Explain the four OOP pillars out loud without notes; catch up | — | Your `notes.md` |

## Week 3 (30 Nov – 6 Dec): SQL and database theory

By Sunday you can design a small database and write common interview queries.

| Date | Focus | Morning: learn (7:00–8:30) | Work hour: practise | Resources |
| --- | --- | --- | --- | --- |
| Mon 30 Nov | SQL basics | Install PostgreSQL for Windows (with pgAdmin); `CREATE TABLE`, data types, `SELECT`, `WHERE`, `ORDER BY`, `INSERT`, `UPDATE`, `DELETE` | SQLBolt lessons 1–6 | SQLBolt; PostgreSQL docs |
| Tue 1 Dec | Aggregates | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP BY`, `HAVING` | SQLBolt aggregate lessons; pgexercises | SQLBolt; pgexercises.com |
| Wed 2 Dec | Keys and joins | Primary and foreign keys; `INNER JOIN`, `LEFT JOIN`, self join | Join exercises | pgexercises.com |
| Thu 3 Dec | Database theory | Normalisation (1NF, 2NF, 3NF), transactions, ACID, indexes and when to use them | 1 LeetCode easy | LeetCode |
| Fri 4 Dec | Subqueries + Python | Subqueries; connecting Python to PostgreSQL with `psycopg` | Classic interview queries: second-highest salary, finding duplicates | LeetCode Database problems |
| Sat 5 Dec (3 hrs) | Mini-project | A stock database with `companies` and `daily_prices` tables; load a CSV; write 10 useful queries | — | PostgreSQL `COPY` docs |
| Sun 6 Dec | Review | Explain normalisation and ACID out loud; catch up | — | Your `notes.md` |

## Week 4 (7–13 Dec): REST APIs and Linux

By Sunday you can build a CRUD API with login and a database, the usual junior take-home task.

| Date | Focus | Morning: learn (7:00–8:30) | Work hour: practise | Resources |
| --- | --- | --- | --- | --- |
| Mon 7 Dec | How the web works | HTTP methods, status codes, headers, REST principles, JSON; watch requests in the browser's DevTools Network tab | Call public APIs with `curl` or Postman | MDN Web Docs (HTTP) |
| Tue 8 Dec | FastAPI basics | Install FastAPI and Uvicorn; routes, path and query parameters, Pydantic models, the auto-generated `/docs` page | 1 LeetCode easy | FastAPI official tutorial |
| Wed 9 Dec | FastAPI + database | Connect to PostgreSQL with SQLAlchemy; create, read, update, delete endpoints | 1 LeetCode easy | FastAPI docs (SQL databases) |
| Thu 10 Dec | Auth + validation | Password hashing, JWT login, input validation, error responses | 1 LeetCode easy | FastAPI docs (Security) |
| Fri 11 Dec | Linux essentials | In WSL: navigating, files, permissions with `chmod`, `grep`, pipes, processes, `apt` | 1 LeetCode easy | Ubuntu command-line tutorial |
| Sat 12 Dec (3 hrs) | Take-home practice | A stock watchlist REST API with login, CRUD and PostgreSQL; README listing the endpoints | — | FastAPI docs |
| Sun 13 Dec | Review | Catch up; tidy the API code and README | — | Your `notes.md` |

## Week 5 (14–20 Dec): Interview sprint

By Sunday you can answer common theory questions, have a CV ready, and have done one mock interview.

| Date | Focus | Morning: learn (7:00–8:30) | Work hour: practise | Resources |
| --- | --- | --- | --- | --- |
| Mon 14 Dec | Operating systems | Process vs thread, deadlock and its conditions, memory and paging basics, CPU scheduling | 1 LeetCode easy | GeeksforGeeks OS interview questions |
| Tue 15 Dec | Networking | TCP vs UDP, IP and DNS, HTTP vs HTTPS, what happens when you type a URL | 1 LeetCode easy | MDN Web Docs |
| Wed 16 Dec | JavaScript basics | `let`/`const`/`var`, `==` vs `===`, arrow functions, promises, `async`/`await` | 1 LeetCode easy | MDN JavaScript Guide |
| Thu 17 Dec | CV and profiles | One-page CV, LinkedIn profile, GitHub profile README, pin your best repos | 1 LeetCode easy | GitHub Docs (profile README) |
| Fri 18 Dec | Interview answers | Prepare: tell me about yourself, a 2-minute NEPSE thesis pitch, your KIRDARC work, why this company | 1 LeetCode easy | Your `notes.md` |
| Sat 19 Dec (3 hrs) | Mock interview | 30 minutes technical and 15 minutes HR with a friend, then a timed 2-hour take-home: a small CRUD API | — | Your Week 4 API as reference |
| Sun 20 Dec | Month review | Go through the interview-ready check in the 6-month schedule; list weak spots for Month 2 | — | 6-month schedule doc |
