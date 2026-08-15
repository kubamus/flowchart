# Tanstack agent rules

This project is highly dependent on the Tanstack ecosystem.
Tanstack libraries used in this project include breaking changes that may all differ from your training data.
You must read docs that are available at https://tanstack.com/llms.txt before doing any work on this project.
Since we are using tanstack ecosystem, you can add other tanstack libraries to the project if you think they will help you complete your tasks, but you must read their docs before using them.

# Task completion rules

After completing each task, you must test it, either by using computer use skill and/or by doing the testing by code.

# Coding style requirements

- Do not use `any` in TypeScript
- YAGNI (You Aren't Gonna Need It) principle should be followed
- If you have two implementations, first evaluate readability and maintainability. If one is more readable and maintainable but harder to implement, choose that one. If both are equally readable, choose the easier one.
