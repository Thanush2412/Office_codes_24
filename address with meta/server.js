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
        this.currentTab = 0;
        this.tabs = [];
        this.mode = null; // 'places' or 'names'
    }

    async startScraping() {
        console.log(chalk.blue.bold('🤖 Starting MetaAI Scraper...'));
        
        // Ask user for scraping mode
        this.mode = await this.askScrapingMode();
        
        this.spinner.start(chalk.yellow('Navigating to URL...'));
        await this.driver.get(this.url);
        this.tabs.push(await this.driver.getWindowHandle());
        await this.delay(3000);
        this.spinner.succeed(chalk.green('Successfully loaded URL'));

        await this.initialInteraction();
        
        console.log(chalk.cyan.bold(`\n📝 Enter ${this.mode === 'places' ? 'Place Names' : 'Names'} to Process:`));
        const items = await this.manualInput();
        const cleanedItems = this.mode === 'places' ? 
            this.cleanPlaceNames(items) : 
            this.cleanNames(items);
        
        console.log(chalk.yellow(`\n🔍 Total items to process: ${chalk.bold(cleanedItems.length)}`));
        await this.processBatches(cleanedItems);
    }

    async askScrapingMode() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(chalk.cyan('Select scraping mode:\n1) Places (for pincodes)\n2) Names (for gender and religion)\nChoice: '), (answer) => {
                rl.close();
                resolve(answer === '1' ? 'places' : 'names');
            });
        });
    }

    async typeWithAnimation(element, text, speed = 30) {
        for (let char of text) {
            await element.sendKeys(char);
            await this.delay(speed);
        }
        await element.sendKeys(Key.RETURN);
        await this.delay(2000);
        try {
            await this.driver.wait(
                until.elementLocated(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[3]/div/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')),
                5000
            );
            await this.driver.wait(
                until.stalenessOf(await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[3]/div/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea'))),
                15000
            );
        } catch (e) {
            await this.delay(2000);
        }
    }

    async initialInteraction() {
        try {
            this.spinner.start(chalk.yellow('Performing initial interaction...'));

            const textArea = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[3]/div/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );

            await this.typeWithAnimation(textArea, 'hello meta');
            await this.delay(2000);

            const firstButton = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div')
            );
            await firstButton.click();
            await this.delay(2000);

            if (this.mode === 'names') {
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
            }

            this.spinner.succeed(chalk.green('Initial interaction complete'));
        } catch (error) {
            this.spinner.fail(chalk.red('Error during initial interaction'));
            console.error(chalk.red('Error details:'), error);
        }
    }

    async sendQueryAndWaitForResponse(items, batchIndex) {
        try {
            const query = this.mode === 'places' ?
                `${items.join(': ')} give me pincode for these places in table with S.No` :
                `${items.join(', ')} give me gender and religion for given data with S.Number in table`;
            
            this.spinner.start(chalk.yellow('Submitting query...'));
            
            const inputField = await this.driver.findElement(
                By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea')
            );
            await inputField.clear();

            for (let char of query) {
                await inputField.sendKeys(char);
                await this.delay(10);
            }

            await inputField.sendKeys(Key.RETURN);
            
            const tableXPath = batchIndex === 0 ? '(//table)[1]' : `(//table)[${batchIndex + 1}]`;
            await this.driver.wait(until.elementLocated(By.xpath(tableXPath)), 10000);
            await this.delay(2000);
            
            this.spinner.succeed(chalk.green('Query submitted successfully'));
        } catch (error) {
            this.spinner.fail(chalk.red('Error submitting query'));
            console.error(chalk.red('Error details:'), error);
        }
    }

    async processBatches(items) {
        const BATCH_SIZE = 50;
        const BATCHES_PER_TAB = this.mode === 'places' ? 3 : 4;
        const batches = this.chunkArray(items, BATCH_SIZE);
        const totalBatches = batches.length;
        
        console.log(chalk.blue(`\n📊 Processing ${totalBatches} batches...\n`));

        for (let i = 0; i < batches.length; i++) {
            if (i > 0 && i % BATCHES_PER_TAB === 0) {
                await this.openNewTab();
            }

            const tabIndex = Math.floor(i / BATCHES_PER_TAB);
            await this.driver.switchTo().window(this.tabs[tabIndex]);

            console.log(chalk.yellow(`\n🔄 Processing Batch ${i + 1}/${totalBatches} (Tab ${tabIndex + 1})`));
            const batchResults = this.mode === 'places' ?
                await this.processPlaceNames(batches[i], i) :
                await this.processNames(batches[i], i);
            this.allBatchResults.push(...batchResults);

            await this.delay(2000);
        }

        await this.displayFinalResults();
        await this.handleDataSaving();
    }

    async openNewTab() {
        this.spinner.start(chalk.yellow('Opening new tab...'));
        await this.driver.executeScript('window.open()');
        const handles = await this.driver.getAllWindowHandles();
        const newTab = handles[handles.length - 1];
        this.tabs.push(newTab);
        await this.driver.switchTo().window(newTab);
        await this.driver.get(this.url);
        await this.delay(3000);
        await this.initialInteraction();
        this.spinner.succeed(chalk.green('New tab ready'));
        this.currentTab++;
    }

    async processPlaceNames(placeNames, batchIndex) {
        const progressLoader = new ProgressLoader(placeNames.length);
        const batchResults = [];

        try {
            progressLoader.render();

            await this.sendQueryAndWaitForResponse(placeNames, batchIndex);
            
            // Fetch data from both tables
            const tableData1 = await this.getAllPlacesData();
            const tableData2 = await this.getAllPlacesData(); // Scrape the second table

            // Combine results from both tables into a single array
            const combinedData = [...tableData1, ...tableData2];
            
            progressLoader.setTableData(combinedData);
            
            for (let placeName of placeNames) {
                const result = combinedData.find(row => 
                    row.place.toLowerCase().trim() === placeName.toLowerCase().trim()
                );
                
                if (result) {
                    batchResults.push(result);
                } else {
                    progressLoader.addError(placeName);
                }
            }

        } catch (error) {
            console.error(chalk.red(`Error processing batch ${batchIndex + 1}:`, error));
        }

        progressLoader.complete();
        return batchResults;
    }

    async processNames(names, batchIndex) {
        const batchResults = [];
        const progressLoader = new ProgressLoader(names.length);

        await this.sendQueryAndWaitForResponse(names, batchIndex);

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

    async getAllPlacesData() {
        try {
            const table = await this.driver.wait(
                until.elementLocated(By.xpath('//table')), // Modify if there are multiple tables
                15000
            );
            
            const rows = await table.findElements(By.xpath('.//tr'));
            const tableData = [];
            
            for (let row of rows) {
                const cells = await row.findElements(By.xpath('.//td'));
                if (cells.length >= 3) {
                    const place = await cells[1].getText();
                    const pincode = await cells[2].getText();
                    tableData.push({ place, pincode });
                }
            }
            
            return tableData;
        } catch (error) {
            console.error(chalk.red('Error getting table data:', error));
            return [];
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

    async manualInput() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            let items = [];

            const askItem = () => {
                const prompt = this.mode === 'places' ? 
                    'Enter a place name (or type "done" when finished): ' :
                    'Enter a name (or type "done" when finished): ';

                rl.question(chalk.cyan(prompt), (item) => {
                    item = item.trim();

                    if (item.toLowerCase() === 'done') {
                        if (items.length === 0) {
                            console.log(chalk.red(`You must enter at least one ${this.mode === 'places' ? 'place name' : 'name'}.`));
                            return askItem();
                        }
                        rl.close();
                        resolve(items);
                    } else {
                        if (item) {
                            items.push(item);
                            console.log(chalk.green(`✓ Added ${this.mode === 'places' ? 'place name' : 'name'}: ${item}`));
                        }
                        askItem();
                    }
                });
            };

            askItem();
        });
    }

    async displayFinalResults() {
        console.log(chalk.green.bold('\n📊 Final Results Summary:'));
        
        const table = new Table({
            head: this.mode === 'places' ?
                [chalk.blue.bold('S.No'), chalk.blue.bold('Place Name'), chalk.blue.bold('Pincode')] :
                [chalk.blue.bold('S.No'), chalk.blue.bold('Name'), chalk.blue.bold('Gender'), chalk.blue.bold('Religion')],
            colWidths: this.mode === 'places' ? [8, 30, 20] : [8, 30, 20, 20],
            style: { head: [], border: [] }
        });

        this.allBatchResults.forEach((result, index) => {
            if (this.mode === 'places') {
                table.push([
                    chalk.white(index + 1),
                    chalk.cyan(result.place),
                    chalk.yellow(result.pincode)
                ]);
            } else {
                table.push([
                    chalk.white(index + 1),
                    chalk.cyan(result.name),
                    chalk.yellow(result.gender),
                    chalk.green(result.religion)
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

        const headers = this.mode === 'places' ?
            ['S.No', 'Place Name', 'Pincode'] :
            ['S.No', 'Name', 'Gender', 'Religion'];

        const excelData = [
            headers,
            ...this.allBatchResults.map((result, index) => {
                if (this.mode === 'places') {
                    return [index + 1, result.place, result.pincode];
                } else {
                    return [index + 1, result.name, result.gender, result.religion];
                }
            })
        ];

        const ws = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        
        const filename = `meta_ai_results_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        console.log(chalk.green(`\n💾 Results saved to ${chalk.bold(filename)}`));
    }

    async saveResultsToCSV() {
        if (this.allBatchResults.length === 0) {
            this.spinner.fail(chalk.red('No data to save!'));
            return;
        }

        const csvData = this.allBatchResults.map((result, index) => {
            if (this.mode === 'places') {
                return {
                    'S.No': index + 1,
                    'Place Name': result.place,
                    'Pincode': result.pincode
                };
            } else {
                return {
                    'S.No': index + 1,
                    'Name': result.name,
                    'Gender': result.gender,
                    'Religion': result.religion
                };
            }
        });

        const csv = parse(csvData);
        const filename = `meta_ai_results_${new Date().toISOString().slice(0,10)}.csv`;
        fs.writeFileSync(filename, csv);
        console.log(chalk.green(`\n💾 Results saved to ${chalk.bold(filename)}`));
    }

    cleanPlaceNames(names) {
        return names.map(name => name.trim()).filter(name => name);
    }

    cleanNames(names) {
        return names.map(name => {
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
        }).filter(name => name);
    }

    chunkArray(array, size) {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
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