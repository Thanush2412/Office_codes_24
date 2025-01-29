const { Builder, By, until, Key } = require('selenium-webdriver');
const readline = require('readline');
const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');

class MetaAIScraper {
    constructor(driver, url) {
        this.driver = driver;
        this.url = url;
        this.fetchedResults = [];
        this.spinner = ora();
        this.currentListIndex = 0;
        this.failedNames = [];
        this.lastInputText = '';  // Store the last input text
    }

    async startScraping() {
        console.log(chalk.blueBright('🤖 Starting MetaAI Scraper...'));
        this.spinner.start(chalk.yellowBright('Navigating to URL...'));

        try {
            await this.driver.get(this.url);
            await this.delay(3000);
            this.spinner.succeed(chalk.greenBright('Successfully loaded URL'));

            await this.initialInteraction();

            console.log(chalk.cyanBright('\n📝 Enter Names to Process:'));
            const names = await this.manualInput();

            console.log(chalk.magentaBright('\n🔍 Processing names sequentially...'));
            await this.processNamesSequentially(names);
        } catch (error) {
            console.error(chalk.redBright('❌ Critical error during scraping:'), error);
        }
    }

    async humanType(element, text) {
        for (const char of text) {
            await element.sendKeys(char);
            await this.delay(5);
        }
    }

    async processNamesSequentially(names) {
        let remainingNames = [...names];
        let failedNames = [];  // To track names that failed

        while (remainingNames.length > 0) {
            for (const name of remainingNames) {
                console.log(chalk.yellowBright(`\n🏷️ Processing name: ${name}`));

                try {
                    await this.sendSingleNameQuery(name);
                    await this.delay(500);

                    // Remove successfully processed name
                    remainingNames = remainingNames.filter(n => n !== name);
                } catch (error) {
                    console.error(chalk.redBright(`❌ Failed to process ${name}:`, error));
                    // Add to failed names for potential retry
                    if (!failedNames.includes(name)) {
                        failedNames.push(name);
                    }
                }
            }

            // If there are failed names, attempt to process them
            if (failedNames.length > 0) {
                console.log(chalk.yellowBright(`\n🔄 Retrying ${failedNames.length} failed names...`));
                remainingNames = [...failedNames];  // Set remaining names to failed names
                failedNames = [];  // Reset failed names list

                // Refresh the page before retrying
                await this.driver.navigate().refresh();
                await this.delay(3000);

                // Reset the list index to 0 when refreshing the page
                this.currentListIndex = 0;

                await this.initialInteraction();

                // Save after refresh
                await this.autoSave();

            } else {
                break;
            }

            const continueProcessing = await this.confirmContinue();
            if (!continueProcessing) break;
        }

        await this.handleDataSaving();

        // Log any persistently failed names
        if (failedNames.length > 0) {
            console.log(chalk.redBright('\n❗ The following names could not be processed:'));
            failedNames.forEach(name => console.log(chalk.redBright(`- ${name}`)));
        }
    }

    async sendSingleNameQuery(name) {
        try {
            this.spinner.start(chalk.yellowBright(`Preparing query for ${name}...`));

            const inputField = await this.waitAndFindElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );
            await inputField.clear();

            const queryText = `give me ${name} with complete address with pincode in single line numbered 1 .`;
            this.lastInputText = queryText;  // Store the last input
            await this.humanType(inputField, queryText);

            await this.delay(200);

            const sendButtons = await this.driver.findElements(By.css('div[role="button"]'));
            if (sendButtons.length > 0) {
                await sendButtons[sendButtons.length - 1].click();
            } else {
                throw new Error(chalk.redBright('Send button not found'));
            }

            this.spinner.start(chalk.yellowBright(`Fetching results for ${name}...`));

            // Check if the error message "Sign in to continue" or "max conversation length" is present
            await this.checkForErrorsAndRetry();

            const resultsFound = await this.extractNextListResults(queryText, name);

            if (!resultsFound) {
                throw new Error(chalk.redBright('No results found'));
            }

            this.spinner.succeed(chalk.greenBright(`Completed query for ${name}`));
            return true;
        } catch (error) {
            console.error(chalk.redBright(`Error processing ${name}:`), error);
            await this.handleQueryError(name, this.lastInputText);
            throw error;
        }
    }

    // New auto-save function
    async autoSave() {
        if (this.fetchedResults.length === 0) {
            console.log(chalk.yellowBright('No data to save.'));
            return;
        }

        const outputText = this.fetchedResults.join('\n');
        const fileName = 'output_auto_saved.txt';

        fs.appendFileSync(fileName, '\n' + outputText);
        console.log(chalk.greenBright(`Results auto-saved to ${fileName}.`));
    }

    async checkForErrorsAndRetry() {
        const errorMessages = [
            "You've reached the maximum conversation length without logging in. Start a new conversation or Login in to continue"
        ];

        const errorXPath = "/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[1]/div/div/div[1]/div/div[103]/div/div[2]/div/div/div[2]/div/div/div/div/span";

        try {
            const errorMessageElement = await this.driver.findElement(By.xpath(errorXPath));
            const errorMessageText = await errorMessageElement.getText();

            // Check for specific error message
            if (errorMessages.some(msg => errorMessageText.includes(msg))) {
                console.log(chalk.redBright('❌ Error: Conversation limit reached. Reloading page and retrying...'));
                await this.driver.navigate().refresh();
                await this.delay(3000);

                // Reset the list index to 0 when refreshing the page
                this.currentListIndex = 0;

                // Reinitialize the conversation
                await this.initialInteraction();

                // Resend the last input text
                const inputField = await this.waitAndFindElement(
                    By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
                );
                await inputField.clear();
                await this.humanType(inputField, this.lastInputText);  // Resend last input
                await this.delay(200);

                const sendButtons = await this.driver.findElements(By.css('div[role="button"]'));
                if (sendButtons.length > 0) {
                    await sendButtons[sendButtons.length - 1].click();
                }
                await this.delay(200);
                return true;  // Return true to continue after the retry
            }
        } catch (error) {
            // Error element not found, no action needed
        }

        return false;
    }

    async extractNextListResults(queryText, name) {
        const listXPath = '//ol';
        let retries = 3;

        // Keep track of where we are in the list
        const lastFetchedIndex = this.currentListIndex;

        while (retries > 0) {
            try {
                await this.driver.wait(async () => {
                    try {
                        const lists = await this.driver.findElements(By.xpath(listXPath));
                        return lists.length > this.currentListIndex;
                    } catch {
                        return false;
                    }
                }, 15000);

                const resultLists = await this.driver.findElements(By.xpath(listXPath));

                if (this.currentListIndex < resultLists.length) {
                    const resultList = resultLists[this.currentListIndex];
                    const listItems = await resultList.findElements(By.xpath('.//li'));

                    if (listItems.length === 0) {
                        console.log(chalk.yellowBright('No list items found, possibly a sign-in prompt or invalid result.'));
                        retries--;

                        // Check if we need to refresh due to sign-in or non-list result
                        const errorMessageXPath = '/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[1]/div/div/div[1]/div/div[103]/div/div[2]/div/div/div[2]/div/div/div/div/span';
                        try {
                            const errorMessageElement = await this.driver.findElement(By.xpath(errorMessageXPath));
                            const errorMessageText = await errorMessageElement.getText();
                            if (errorMessageText.includes("Sign in to continue")) {
                                console.log(chalk.redBright('❌ Error: Sign-in prompt detected. Reloading the page...'));
                                await this.driver.navigate().refresh();
                                await this.delay(3000);

                                // Reset the list index to 0 when refreshing the page
                                this.currentListIndex = 0;

                                await this.initialInteraction(); // Perform the initial interaction again if needed
                                await this.humanType(await this.waitAndFindElement(
                                    By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
                                ), queryText);
                                return;
                            }
                        } catch (error) {
                            // Error message not found, continue normal processing
                        }

                        await this.delay(2000);
                        continue;
                    }

                    await this.delay(500);

                    // Open output.txt in append mode
                    const outputStream = fs.createWriteStream('output.txt', { flags: 'a' });

                    // Write name as a header for each query's results
                    outputStream.write(`\n${name}\n`);

                    for (let i = 0; i < listItems.length; i++) {
                        try {
                            const listItem = listItems[i];
                            const itemText = await listItem.getText();

                            this.fetchedResults.push(itemText);

                            this.delay(2500)
                            // Write each item to the file immediately
                            outputStream.write(`${itemText}\n`);

                            console.log(chalk.cyanBright(`Result item ${i + 1}:`), itemText);
                        } catch (itemError) {
                            console.log(chalk.redBright(`Could not extract item ${i + 1}`));
                        }
                    }

                    // Close the write stream
                    outputStream.end();

                    this.currentListIndex++;
                    return true;
                } else {
                    console.log(chalk.yellowBright('No new lists to process'));
                    return false;
                }
            } catch (error) {
                retries--;
                console.log(chalk.yellowBright(`Retry ${4 - retries}. Waiting...`));
                await this.delay(1000);
            }
        }

        console.log(chalk.redBright('No results found after multiple attempts'));
        return false;
    }

    async handleQueryError(name, queryText) {
        try {
            console.log(chalk.yellowBright('Attempting to recover from error...'));
            await this.driver.navigate().refresh();
            await this.delay(3000);

            // Reset the list index to 0 when refreshing the page
            this.currentListIndex = 0;

            await this.initialInteraction();

            const inputField = await this.waitAndFindElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );
            await inputField.clear();

            await this.humanType(inputField, queryText);
            await this.delay(200);

            const sendButtons = await this.driver.findElements(By.css('div[role="button"]'));
            if (sendButtons.length > 0) {
                await sendButtons[sendButtons.length - 1].click();
            }

            await this.extractNextListResults(queryText, name);
        } catch (recoveryError) {
            console.log(chalk.redBright(`Failed to recover for ${name}:`), recoveryError);
        }
    }

    async waitAndFindElement(locator, timeout = 10000) {
        return await this.driver.wait(
            until.elementLocated(locator),
            timeout,
            'Element not found within the specified time'
        );
    }

    async confirmContinue() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(chalk.magentaBright('Continue processing the failed names? (yes/no): '), (answer) => {
                rl.close();
                resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
            });
        });
    }

    async handleDataSaving() {
        if (this.fetchedResults.length === 0) {
            console.log(chalk.yellowBright('No data available to save.'));
            return;
        }

        const outputText = this.fetchedResults.join('\n');
        const fileName = 'output.txt';

        const saveOptions = await this.getSaveOptions(fileName);

        switch (saveOptions) {
            case '1': // Append
                fs.appendFileSync(fileName, '\n' + outputText);
                console.log(chalk.greenBright('Results appended successfully.'));
                break;
            case '2': // Overwrite
                fs.writeFileSync(fileName, outputText);
                console.log(chalk.greenBright('Results saved successfully.'));
                break;
            case '3': // Cancel
                console.log(chalk.yellowBright('Saving cancelled.'));
                break;
        }

        // Save failed names to a separate file if any
        if (this.failedNames.length > 0) {
            const failedNamesFile = 'failed_names.txt';
            fs.writeFileSync(failedNamesFile, this.failedNames.join('\n'));
            console.log(chalk.yellowBright(`Failed names saved to ${failedNamesFile}`));
        }
    }

    async getSaveOptions(fileName) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const fileExists = fs.existsSync(fileName);

            if (!fileExists) {
                fs.writeFileSync(fileName, '');
                resolve('2');
                rl.close();
                return;
            }

            const existingContent = fs.readFileSync(fileName, 'utf8');

            console.log(chalk.cyanBright('\nExisting file content:'));
            console.log(existingContent ? existingContent : '[File is empty]');

            rl.question(chalk.magentaBright('\nChoose save option:\n1. Append to existing file\n2. Overwrite existing file\n3. Cancel saving\nEnter your choice (1/2/3): '), (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

    async initialInteraction() {
        try {
            this.spinner.start(chalk.yellowBright('Performing initial interaction...'));

            const textArea = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[3]/div/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );

            await this.humanType(textArea, 'hello meta give the following outputs as ordered list');
            await textArea.sendKeys(Key.RETURN);
            await this.delay(1000);

            await this.clickXPath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div');

            const searchBox = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div')
            );
            await searchBox.sendKeys('2000');
            await this.delay(1000);

            await this.clickXPath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div[2]/div/div/div/div[2]/div/div/div/div/div');

            await this.clickXPath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div[2]/div/div/div/div[3]/div/div/div/div/div');

            this.spinner.succeed(chalk.greenBright('Initial interaction complete'));
        } catch (error) {
            this.spinner.fail(chalk.redBright('Error during initial interaction'));
            console.error(chalk.redBright('Error details:'), error);
        }
    }

    async clickXPath(xpath) {
        const button = await this.driver.findElement(By.xpath(xpath));
        await button.click();
        await this.delay(1000);
    }

    async manualInput() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            let names = [];

            const askName = () => {
                rl.question(chalk.cyanBright('Enter a name (or type "done" when finished): '), (name) => {
                    name = name.trim();

                    if (name.toLowerCase() === 'done') {
                        rl.close();
                        resolve(names);
                    } else {
                        if (name) {
                            names.push(name);
                            console.log(chalk.greenBright(`✅ Added name: ${name}`));
                        }
                        askName();
                    }
                });
            };

            askName();
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

(async () => {
    const driver = await new Builder().forBrowser('chrome').build();
    const url = 'https://meta.ai';

    const scraper = new MetaAIScraper(driver, url);
    await scraper.startScraping();

    await driver.quit();
})();