const { Builder, By, until, Key } = require('selenium-webdriver');
const Table = require('cli-table3');
const readline = require('readline');
const fs = require('fs');
const XLSX = require('xlsx');
const { parse } = require('json2csv');
const chalk = require('chalk');
const ora = require('ora');

class ProgressLoader {
    constructor(totalItems) {
        this.current = 0;
        this.total = totalItems;
        this.errorMessages = [];
        this.isComplete = false;
    }

    update(value, errorMessage = null) {
        this.current = value;
        if (errorMessage) {
            this.errorMessages.push(errorMessage);
        }
        this.render();
    }

    render() {
        const percentage = Math.round((this.current / this.total) * 100);
        const filled = Math.round((percentage / 100) * 20);
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '▒'.repeat(empty);
        
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`Progress: ${bar} ${percentage}%`);
        
        if (this.errorMessages.length > 0) {
            process.stdout.write(`\n⚠️ ${this.errorMessages[this.errorMessages.length - 1]}`);
            this.errorMessages = [];
        }
    }

    complete() {
        this.isComplete = true;
        process.stdout.write('\n');
    }
}

class MetaAIScraper {
    constructor(driver, url) {
        this.driver = driver;
        this.url = url;
        this.processedResults = [];
        this.allBatchResults = [];
        this.spinner = ora();
        this.mode = null;
    }

    async startScraping() {
        console.log(chalk.blue.bold('🤖 Starting MetaAI Scraper...'));
        
        // Ask user to select mode
        this.mode = await this.selectMode();
        
        this.spinner.start(chalk.yellow('Navigating to URL...'));
        await this.driver.get(this.url);
        await this.delay(3000);
        this.spinner.succeed(chalk.green('Successfully loaded URL'));

        await this.initialInteraction();
        
        console.log(chalk.cyan.bold('\n📝 Enter Names to Process:'));
        const names = await this.manualInput();
        const cleanedNames = this.cleanNames(names);
        
        console.log(chalk.yellow(`\n🔍 Total names to process: ${chalk.bold(cleanedNames.length)}`));
        await this.processBatches(cleanedNames);
    }

    async selectMode() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            console.log(chalk.cyan.bold('\nSelect Mode:'));
            console.log(chalk.yellow('1) Get Gender and Religion'));
            console.log(chalk.yellow('2) Get Pincode Information'));

            rl.question(chalk.cyan('Enter your choice (1 or 2): '), (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }

    async initialInteraction() {
        try {
            this.spinner.start(chalk.yellow('Performing initial interaction...'));

            const textArea = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[3]/div/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );
            await textArea.sendKeys('hello meta', Key.RETURN);
            await this.delay(2000);

            const firstButton = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div')
            );
            await firstButton.click();
            await this.delay(2000);

            const searchBox = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div')
            );
            await searchBox.sendKeys('2000');
            await this.delay(2000);

            const secondButton = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div[2]/div/div/div/div[2]/div/div/div/div/div')
            );
            await secondButton.click();
            await this.delay(2000);

            const thirdButton = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div[2]/div/div/div/div[3]/div/div/div/div/div')
            );
            await thirdButton.click();
            await this.delay(2000);

            this.spinner.succeed(chalk.green('Initial interaction complete'));
        } catch (error) {
            this.spinner.fail(chalk.red('Error during initial interaction'));
            console.error(chalk.red('Error details:'), error);
        }
    }

    async manualInput() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            let names = [];
            const inputType = this.mode === '1' ? 'name' : 'location';

            const askInput = () => {
                rl.question(chalk.cyan(`Enter a ${inputType} (or type "done" when finished): `), (input) => {
                    input = input.trim();

                    if (input.toLowerCase() === 'done') {
                        if (names.length === 0) {
                            console.log(chalk.red(`You must enter at least one ${inputType}.`));
                            return askInput();
                        }
                        rl.close();
                        resolve(names);
                    } else {
                        if (input) {
                            names.push(input);
                            console.log(chalk.green(`✓ Added ${inputType}: ${input}`));
                        }
                        askInput();
                    }
                });
            };

            askInput();
        });
    }

    cleanName(name) {
        try {
            if (!name || typeof name !== 'string') {
                return "";
            }

            let cleanedName = name.trim();
            cleanedName = cleanedName.replace(/\./g, ' ');
            cleanedName = cleanedName.replace(/[^a-zA-Z\s-]/g, '');
            cleanedName = cleanedName.replace(/\s+/g, ' ');

            const words = cleanedName.split(' ');
            cleanedName = words.filter(word => word.length > 1).join(' ');

            cleanedName = cleanedName
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            return cleanedName;
        } catch (error) {
            console.error(chalk.red(`Error cleaning input '${name}':`, error));
            return "";
        }
    }

    cleanNames(names) {
        return names.map(name => this.cleanName(name)).filter(name => name);
    }

    async processBatches(names) {
        const batchSize = 50;
        const batches = this.chunkArray(names, batchSize);
        const totalBatches = batches.length;
        let batchCount = 0;
        
        console.log(chalk.blue(`\n📊 Processing ${totalBatches} batches...\n`));

        for (let i = 0; i < totalBatches; i++) {
            if (batchCount === 4) {
                this.spinner.start(chalk.yellow('Opening new tab...'));
                await this.driver.executeScript('window.open()');
                const allTabs = await this.driver.getAllWindowHandles();
                await this.driver.switchTo().window(allTabs[allTabs.length - 1]);
                await this.driver.get(this.url);
                await this.delay(3000);
                this.spinner.succeed(chalk.green('New tab ready'));
                batchCount = 0;
            }

            console.log(chalk.yellow(`\n🔄 Processing Batch ${i + 1}/${totalBatches}`));
            const batchResults = await this.processNames(batches[i], i);
            this.allBatchResults.push(...batchResults);
            batchCount++;
        }

        await this.displayFinalResults();
        await this.handleDataSaving();
    }

    chunkArray(array, chunkSize) {
        const result = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            result.push(array.slice(i, i + chunkSize));
        }
        return result;
    }

    async processNames(names, batchIndex) {
        const batchResults = [];
        const progressLoader = new ProgressLoader(names.length);

        await this.sendQueryAndClickButton(names, batchIndex);

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            let result;
            
            if (this.mode === '1') {
                result = await this.getGenderAndReligionForName(name, batchIndex);
            } else {
                result = await this.getPincodeForLocation(name, batchIndex);
            }
            
            if (result) {
                batchResults.push(result);
                progressLoader.update(i + 1);
            } else {
                progressLoader.update(i + 1, `Could not find data for: ${name}`);
            }

            await this.delay(100);
        }

        progressLoader.complete();
        return batchResults;
    }

    async sendQueryAndClickButton(names, batchIndex) {
        try {
            const queryText = this.mode === '1' 
                ? `${names.join(', ')} give me gender and religion for given data with S.Number in table`
                : `${names.join(', ')} give me pincode information for these locations in table format with S.Number`;
            
            this.spinner.start(chalk.yellow('Submitting query...'));

            const inputField = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );
            await inputField.clear();

            for (let char of queryText) {
                await inputField.sendKeys(char);
                await this.delay(10);
            }

            const sendButton = await this.driver.findElement(By.className('x1lliihq x2lah0s x1k90msu x2h7rmj x1qfuztq xtk6v10 xxk0z11 xvy4d1p'));
            await sendButton.click();

            const tableXPath = batchIndex === 0 ? '(//table)[1]' : `(//table)[${batchIndex + 1}]`;
            await this.driver.wait(until.elementLocated(By.xpath(tableXPath)), 10000);
            await this.delay(2000);

            this.spinner.succeed(chalk.green('Query submitted successfully'));
        } catch (error) {
            this.spinner.fail(chalk.red('Error submitting query'));
            console.error(chalk.red('Error details:'), error);
        }
    }

    async getGenderAndReligionForName(name, batchIndex) {
        try {
            let retries = 0;
            let result = null;

            while (retries < 3 && !result) {
                const tableXPath = batchIndex === 0 ? '(//table)[1]' : `(//table)[${batchIndex + 1}]`;
                const resultTable = await this.driver.findElement(By.xpath(tableXPath));
                const rows = await resultTable.findElements(By.xpath('.//tr'));

                for (let row of rows) {
                    const cells = await row.findElements(By.xpath('.//td'));

                    if (cells.length >= 4) {
                        const nameInTable = await cells[1].getText();
                        const gender = await cells[2].getText();
                        const religion = await cells[3].getText();

                        if (nameInTable.trim() === name) {
                            result = { name: nameInTable, gender, religion };
                            break;
                        }
                    }
                }

                if (!result) {
                    retries++;
                    await this.delay(1000);
                }
            }

            return result;
        } catch (error) {
            console.error(chalk.red(`Error processing name '${name}':`, error));
            return null;
        }
    }

    async getPincodeForLocation(location, batchIndex) {
        try {
            let retries = 0;
            let result = null;

            while (retries < 3 && !result) {
                const tableXPath = batchIndex === 0 ? '(//table)[1]' : `(//table)[${batchIndex + 1}]`;
                const resultTable = await this.driver.findElement(By.xpath(tableXPath));
                const rows = await resultTable.findElements(By.xpath('.//tr'));

                for (let row of rows) {
                    const cells = await row.findElements(By.xpath('.//td'));

                    if (cells.length >= 3) {
                        const locationInTable = await cells[1].getText();
                        const pincode = await cells[2].getText();

                        if (locationInTable.trim() === location) {
                            result = { location: locationInTable, pincode };
                            break;
                        }
                    }
                }

                if (!result) {
                    retries++;
                    await this.delay(1000);
                }
            }

            return result;
        } catch (error) {
            console.error(chalk.red(`Error processing location '${location}':`, error));
            return null;
        }
    }

    async displayFinalResults() {
        console.log(chalk.green.bold('\n📊 Final Results Summary:'));
        
        const table = new Table({
            head: this.mode === '1' 
                ? [chalk.blue.bold('S.No'), chalk.blue.bold('Name'), chalk.blue.bold('Gender'), chalk.blue.bold('Religion')]
                : [chalk.blue.bold('S.No'), chalk.blue.bold('Location'), chalk.blue.bold('Pincode')],
            colWidths: this.mode === '1' ? [8, 30, 20, 20] : [8, 40, 20],
            style: { head: [], border: [] }
        });

        this.allBatchResults.forEach((result, index) => {
            if (this.mode === '1') {
                table.push([
                    chalk.white(index + 1),
                    chalk.cyan(result.name),
                    chalk.yellow(result.gender),
                    chalk.green(result.religion)
                ]);
            } else {
                table.push([
                    chalk.white(index + 1),
                    chalk.cyan(result.location),
                    chalk.yellow(result.pincode)
                ]);
            }
        });

        console.log(table.toString());
    }

    async handleDataSaving() {
        const answer = await this.askUserForSaveOption();
        
        this.spinner.start(chalk.yellow('Preparing to save data...'));

        if (answer === '1') {
            await this.saveResultsToExcel();
            this.spinner.succeed(chalk.green('Successfully saved to Excel!'));
        } else if (answer === '2') {
            await this.saveResultsToCSV();
            this.spinner.succeed(chalk.green('Successfully saved to CSV!'));
        } else {
            this.spinner.info(chalk.blue('Skipping save operation'));
        }
    }

    async askUserForSaveOption() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(chalk.cyan('\nSave data as:\n1) Excel\n2) CSV\n3) Skip\nChoice: '), (answer) => {
                rl.close();
                resolve(answer);
            });
        });
    }

    async saveResultsToExcel() {
        if (this.allBatchResults.length === 0) {
            this.spinner.fail(chalk.red('No data to save!'));
            return;
        }

        const headers = this.mode === '1' 
            ? ['S.No', 'Name', 'Gender', 'Religion']
            : ['S.No', 'Location', 'Pincode'];

        const excelData = [
            headers,
            ...this.allBatchResults.map((result, index) => {
                if (this.mode === '1') {
                    return [index + 1, result.name, result.gender, result.religion];
                } else {
                    return [index + 1, result.location, result.pincode];
                }
            })
        ];

        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        
        const prefix = this.mode === '1' ? 'gender_religion' : 'pincode';
        const filename = `meta_ai_${prefix}_results_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        console.log(chalk.green(`\n💾 Results saved to ${chalk.bold(filename)}`));
    }

    async saveResultsToCSV() {
        if (this.allBatchResults.length === 0) {
            this.spinner.fail(chalk.red('No data to save!'));
            return;
        }

        const csvData = this.allBatchResults.map((result, index) => {
            if (this.mode === '1') {
                return {
                    'S.No': index + 1,
                    'Name': result.name,
                    'Gender': result.gender,
                    'Religion': result.religion
                };
            } else {
                return {
                    'S.No': index + 1,
                    'Location': result.location,
                    'Pincode': result.pincode
                };
            }
        });

        const csv = parse(csvData);
        const prefix = this.mode === '1' ? 'gender_religion' : 'pincode';
        const filename = `meta_ai_${prefix}_results_${new Date().toISOString().slice(0,10)}.csv`;
        fs.writeFileSync(filename, csv);
        console.log(chalk.green(`\n💾 Results saved to ${chalk.bold(filename)}`));
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log(chalk.blue.bold('🚀 Initializing MetaAI Scraper...'));
    
    try {
        let driver = await new Builder().forBrowser('chrome').build();
        const scraper = new MetaAIScraper(driver, 'https://meta.ai');
        
        // Handle process termination
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\n\nGracefully shutting down...'));
            await driver.quit();
            process.exit();
        });

        await scraper.startScraping();
        
        console.log(chalk.green.bold('\n✨ Scraping completed successfully!'));
        await driver.quit();
    } catch (error) {
        console.error(chalk.red('\n❌ Fatal error:'), error);
        process.exit(1);
    }
}

main();