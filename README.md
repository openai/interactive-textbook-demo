https://github.com/openai/interactive-textbook-demo/assets/5464875/750e332e-a53d-43ef-9102-4586fd04da54

# Interactive textbook demo

This repository contains the code for an interactive textbook demo that showcases how OpenAI's technologies can be used to make it more accessible to people with visual disabilities or language and learning barriers. 

[Hosted demo](https://interactive-textbook-demo.vercel.app/)


## Development

Create `.env.local` file in the project root and copy the contents of `.env.example` into it. You can create an OpenAI API key here: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

Install dependencies:
```
npm install
```

Run development environment:
```
npm run dev
```

## Using the `trufflehog` Pre-Commit Hook
This repository includes a pre-commit hook that uses the `trufflehog` tool to scan your code for secrets before each commit. This helps prevent secrets, such as API keys and passwords, from being accidentally committed to the repository.

### Prerequisites
Install `pre-commit` by running:
```bash
pip3 install pre-commit
```
Before you can use the `trufflehog` pre-commit hook, you need to have the `trufflehog` tool installed. You can install it using the following command:
```bash
brew install trufflehog
```
Once you have both tools installed, you can run `pre-commit install` to install the pre-commit hooks in your repository:

### Using the Pre-Commit Hook
Once you have the `trufflehog` tool installed and have added the patterns you want to search for (OAI keys added by default), you can use the pre-commit hook to automatically scan your code before each commit. To use the pre-commit hook, simply run the `git commit` command as you normally would. 

The `trufflehog` tool will automatically scan your code for secrets and reject the commit if any are found. If any secrets are found, you will be prompted to remove them before trying.
