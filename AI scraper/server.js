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
        this.allResults = [];
        this.spinner = ora();
        this.currentTabBatchIndex = 0;
        this.excelFilename = `meta_ai_results_${new Date().toISOString().slice(0,10)}.xlsx`;
        this.csvFilename = `meta_ai_results_${new Date().toISOString().slice(0,10)}.csv`;
        this.lastProcessedIndex = 0;
    }

    async loadExistingData() {
        try {
            if (fs.existsSync(this.excelFilename)) {
                const workbook = XLSX.readFile(this.excelFilename);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(worksheet);
                
                this.allResults = data.map(row => ({
                    name: row.Name,
                    gender: row.Gender,
                    religion: row.Religion
                }));
                
                this.lastProcessedIndex = this.allResults.length;
                console.log(chalk.blue(`Loaded ${this.lastProcessedIndex} existing entries`));
            }
        } catch (error) {
            console.error(chalk.yellow('No existing data found or error loading data'));
            this.allResults = [];
            this.lastProcessedIndex = 0;
        }
    }

    async startScraping() {
        console.log(chalk.blue.bold('🤖 Starting MetaAI Scraper...'));
        await this.loadExistingData();
        
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

            const askName = () => {
                rl.question(chalk.cyan('Enter a name (or type "done" when finished): '), (name) => {
                    name = name.trim();

                    if (name.toLowerCase() === 'done') {
                        if (names.length === 0) {
                            console.log(chalk.red('You must enter at least one name.'));
                            return askName();
                        }
                        rl.close();
                        resolve(names);
                    } else {
                        if (name) {
                            names.push(name);
                            console.log(chalk.green(`✓ Added name: ${name}`));
                        }
                        askName();
                    }
                });
            };

            askName();
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
            console.error(chalk.red(`Error cleaning name '${name}':`, error));
            return "";
        }
    }

    cleanNames(names) {
        return names.map(name => this.cleanName(name)).filter(name => name);
    }

    async saveCurrentResults() {
        await this.saveResultsToExcel();
        await this.saveResultsToCSV();
        this.spinner.succeed(chalk.green('Batch results saved to files'));
    }

    chunkArray(array, chunkSize) {
        const result = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            result.push(array.slice(i, i + chunkSize));
        }
        return result;
    }
    
    async processBatches(names) {
    const batchSize = 50;
    const batches = this.chunkArray(names, batchSize);
    const totalBatches = batches.length;
    let batchCount = 0;
    
    console.log(chalk.blue(`\n📊 Processing ${totalBatches} batches...\n`));

    for (let i = 0; i < totalBatches; i++) {
        if (batchCount === 3) {
            this.spinner.start(chalk.yellow('Opening new tab...'));
            await this.driver.executeScript('window.open()');
            const allTabs = await this.driver.getAllWindowHandles();
            await this.driver.switchTo().window(allTabs[allTabs.length - 1]);
            await this.driver.get(this.url);
            await this.delay(3000);
            await this.initialInteraction();
            this.spinner.succeed(chalk.green('New tab ready'));
            batchCount = 0;
            this.currentTabBatchIndex = 0;
        }

        console.log(chalk.yellow(`\n🔄 Processing Batch ${i + 1}/${totalBatches}`));
        const batchResults = await this.processNames(batches[i], this.currentTabBatchIndex);
        
        // Print table for this batch
        console.log(chalk.green(`\n📝 Batch ${i + 1} Results:`));
        const table = new Table({
            head: [
                chalk.blue.bold('S.No'),
                chalk.blue.bold('Name'),
                chalk.blue.bold('Gender'),
                chalk.blue.bold('Religion')
            ],
            colWidths: [8, 30, 20, 20],
            style: { head: [], border: [] }
        });

        batchResults.forEach((result, index) => {
            table.push([
                chalk.white(this.allResults.length + index + 1),
                chalk.cyan(result.name),
                chalk.yellow(result.gender),
                chalk.green(result.religion)
            ]);
        });

        console.log(table.toString());
        
        // Append batch results to allResults
        this.allResults.push(...batchResults);
        
        // Save results after each batch
        await this.saveCurrentResults();

        batchCount++;
        this.currentTabBatchIndex++;
    }

    await this.displayFinalResults();
    console.log(chalk.green.bold('\n✨ All batches processed successfully!'));
}

async processNames(names, batchIndex) {
    const batchResults = [];
    const progressLoader = new ProgressLoader(names.length);

    // Modify input to include sequential numbering
    const numberedNames = names.map((name, index) => `${index + 1}. ${name}`);
    const input = `${numberedNames.join(', ')} give me gender and religion for given data with S.Number in table for all my inputs no extra note or text only table i asked`;
    
    await this.sendQueryAndClickButton([input], batchIndex);

    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const result = await this.getGenderAndReligionForName(name, batchIndex);
        
        if (result) {
            batchResults.push(result);
            progressLoader.update(i + 1);
        } else {
            progressLoader.update(i + 1, `Could not find data for name: ${name}`);
        }

        await this.delay(100);
    }

    progressLoader.complete();
    return batchResults;
}
    async sendQueryAndClickButton(names, batchIndex) {
        try {
            this.spinner.start(chalk.yellow('Submitting query...'));
    
            const inputField = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );
            await inputField.clear();
    
            for (let char of names[0]) {
                await inputField.sendKeys(char);
                await this.delay(10);
            }
    
            const sendButton = await this.driver.findElement(By.className('x1lliihq x2lah0s x1k90msu x2h7rmj x1qfuztq xtk6v10 xxk0z11 xvy4d1p'));
            await sendButton.click();
    
            // Wait until table is present
            const tableXPath = batchIndex === 0 ? '(//table)[1]' : `(//table)[${batchIndex + 1}]`;
            await this.driver.wait(
                async () => {
                    try {
                        const tables = await this.driver.findElements(By.xpath(tableXPath));
                        return tables.length > 0;
                    } catch (error) {
                        return false;
                    }
                },
                30000,  // 30 seconds timeout
                'Table did not appear within the specified time'
            );
    
            this.spinner.succeed(chalk.green('Query submitted successfully'));
        } catch (error) {
            this.spinner.fail(chalk.red('Error submitting query'));
            console.error(chalk.red('Error details:'), error);
            throw error;
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
                        const nameInTable = (await cells[1].getText()).replace(/^\d+\.\s*/, '');
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

    async saveResultsToExcel() {
        if (this.allResults.length === 0) {
            this.spinner.fail(chalk.red('No data to save!'));
            return;
        }

        const excelData = [
            ['S.No', 'Name', 'Gender', 'Religion'],
            ...this.allResults.map((result, index) => [
                index + 1,
                result.name,
                result.gender,
                result.religion
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        
        try {
            XLSX.writeFile(wb, this.excelFilename);
            console.log(chalk.green(`\n💾 Results updated in ${chalk.bold(this.excelFilename)}`));
        } catch (error) {
            console.error(chalk.red(`Error saving Excel file: ${error.message}`));
        }
    }

    async saveResultsToCSV() {
        if (this.allResults.length === 0) {
            this.spinner.fail(chalk.red('No data to save!'));
            return;
        }

        const csvData = this.allResults.map((result, index) => ({
            'S.No': index + 1,
            'Name': result.name,
            'Gender': result.gender,
            'Religion': result.religion
        }));

        try {
            const csv = parse(csvData);
            fs.writeFileSync(this.csvFilename, csv);
            console.log(chalk.green(`\n💾 Results updated in ${chalk.bold(this.csvFilename)}`));
        } catch (error) {
            console.error(chalk.red(`Error saving CSV file: ${error.message}`));
        }
    }

    async displayFinalResults() {
        console.log(chalk.green.bold('\n📊 Final Results Summary:'));
        
        const table = new Table({
            head: [
                chalk.blue.bold('S.No'),
                chalk.blue.bold('Name'),
                chalk.blue.bold('Gender'),
                chalk.blue.bold('Religion')
            ],
            colWidths: [8, 30, 20, 20],
            style: { head: [], border: [] }
        });

        this.allResults.forEach((result, index) => {
            table.push([
                chalk.white(index + 1),
                chalk.cyan(result.name),
                chalk.yellow(result.gender),
                chalk.green(result.religion)
            ]);
        });

        console.log(table.toString());
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log(chalk.blue.bold('🚀 Initializing MetaAI Scraper...'));
    
    let driver;
    try {
        driver = await new Builder().forBrowser('chrome').build();
        const scraper = new MetaAIScraper(driver, 'https://meta.ai');
        
        // Handle process termination
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\n\nGracefully shutting down...'));
            if (driver) {
                await driver.quit();
            }
            process.exit();
        });

        await scraper.startScraping();
        
        console.log(chalk.green.bold('\n✨ Scraping completed successfully!'));
        await driver.quit();
    } catch (error) {
        console.error(chalk.red('\n❌ Fatal error:'), error);
        if (driver) {
            await driver.quit();
        }
        process.exit(1);
    }
}

main();