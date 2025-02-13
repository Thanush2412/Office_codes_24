const { Builder, By, until, Capabilities } = require('selenium-webdriver');
const Table = require('cli-table');  // Using cli-table for table formatting
const readline = require('readline');
const fs = require('fs');
const XLSX = require('xlsx');  // Importing xlsx library to save the data to Excel

class MetaAIScraper {
  constructor(driver, url) {
    this.driver = driver;
    this.url = url;
    this.processedResults = [];
  }

  async startScraping() {
    console.log('Step 1: Navigating to URL...');
    await this.driver.get(this.url);  // Open the URL immediately
    await this.delay(3000);  // Wait 3 seconds for page load

    // Perform the initial interactions (click, type, search, etc.)
    await this.initialInteraction();

    console.log('Step 2: Enter Names...');
    const names = await this.manualInput();  // Wait for user input
    const cleanedNames = this.cleanNames(names);  // Clean the names before processing
    await this.processBatches(cleanedNames);  // Process names in batches
  }

  async initialInteraction() {
    try {
      console.log("Starting initial interaction...");

      // Step 1: Find the text area and type "hello meta" then press Enter
      const textArea = await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[3]/div/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea'));
      await textArea.sendKeys('hello meta');  // Send the text 'hello meta'
      await textArea.sendKeys(Key.RETURN);  // Simulate pressing Enter key
      console.log('Typed "hello meta" and pressed Enter.');
      await this.delay(2000);  // Wait for 2 seconds after typing

      // Step 2: Click the specified button
      const firstButton = await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div'));
      await firstButton.click();
      console.log('Clicked first button.');
      await this.delay(2000);  // Wait for 2 seconds

      // Step 3: Search for value "2000"
      const searchBox = await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div/div/div/div/div/div[4]/div/div/div'));
      await searchBox.sendKeys('2000');  // Enter the value "2000"
      console.log('Searched for value "2000".');
      await this.delay(2000);  // Wait for 2 seconds

      // Step 4: Click the second specified button
      const secondButton = await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div[2]/div/div/div/div[2]/div/div/div/div/div'));
      await secondButton.click();
      console.log('Clicked second button.');
      await this.delay(2000);  // Wait for 2 seconds

      // Step 5: Click the third specified button
      const thirdButton = await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[2]/div/div/div[1]/div[1]/div/div/div[1]/div/div/div[2]/div/div/div/div[3]/div/div/div/div/div'));
      await thirdButton.click();
      console.log('Clicked third button.');
      await this.delay(2000);  // Wait for 2 seconds

      console.log('Initial interaction complete.');
    } catch (error) {
      console.error('Error during initial interaction:', error);
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
        rl.question('Enter a name (or type "done" when finished): ', (name) => {
          name = name.trim();
          
          // If the user enters 'done', resolve and exit the loop
          if (name.toLowerCase() === 'done') {
            if (names.length === 0) {
              console.log('You must enter at least one name.');
              return askName(); // Ask for names again if none entered
            }
            rl.close();
            resolve(names);  // Return the list of names
          } else {
            if (name) {
              names.push(name);
              console.log(`Added name: ${name}`);
            }
            askName();  // Ask for the next name
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

      // Step 1: Remove periods (.) but keep spaces intact
      cleanedName = cleanedName.replace(/\./g, ' ');

      // Step 2: Remove special characters except letters, spaces, and hyphens
      cleanedName = cleanedName.replace(/[^a-zA-Z\s-]/g, '');

      // Step 3: Replace multiple spaces with a single space
      cleanedName = cleanedName.replace(/\s+/g, ' ');

      // Step 4: Remove single-letter words except initials followed by a period
      const words = cleanedName.split(' ');
      cleanedName = words.filter(word => word.length > 1).join(' ');

      // Step 5: Title case the name (first letter uppercase, others lowercase)
      cleanedName = cleanedName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return cleanedName;
    } catch (error) {
      console.error(`Error cleaning name '${name}':`, error);
      return "";
    }
  }

  cleanNames(names) {
    return names.map(name => this.cleanName(name)).filter(name => name); // Clean names and remove any empty strings
  }

  async processBatches(names) {
    const batchSize = 50;
    const batches = this.chunkArray(names, batchSize); // Split names into batches of 50

    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing Batch ${i + 1}/${batches.length}...`);
      await this.processNames(batches[i]);

      if (i < batches.length - 1) {
        // Open a new tab for the next batch
        await this.driver.executeScript('window.open()');
        const allTabs = await this.driver.getAllWindowHandles();
        await this.driver.switchTo().window(allTabs[allTabs.length - 1]);
        await this.driver.get(this.url);  // Reload the URL in the new tab
        await this.delay(3000);  // Wait 3 seconds for page load
      }
    }

    console.log('All batches processed. Saving to file...');
    this.saveResultsToFile(); // Save the results to a file after all batches are processed
  }

  chunkArray(array, chunkSize) {
    const result = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      result.push(array.slice(i, i + chunkSize));
    }
    return result;
  }

  async processNames(names) {
    console.log('Step 3: Processing Names');
    this.processedResults = [];

    // Create a table to display the data, with an additional column for religion
    const table = new Table({
      head: ['S.No', 'Name', 'Gender', 'Religion'],  // Added 'Religion' column
      colWidths: [10, 30, 20, 20]  // Adjusting width for the new column
    });

    // Submit the query and click the button for all names
    await this.sendQueryAndClickButton(names);

    // Fetch and update gender and religion result for each name
    for (const name of names) {
      await this.getGenderAndReligionForName(name, table);
    }

    // Print the table after a 15-second delay
    console.log('Data will be displayed in 15 seconds...');
    await this.delay(15000);
    console.log(table.toString());
  }

  async sendQueryAndClickButton(names) {
    try {
      // Construct input string for names + "give me gender and religion"
      const input = `${names.join(', ')} give me gender and religion for given data with S.Number in table`;

      // Log the input string to check if it's correct
      console.log('Input:', input);

      // Locate the input field and clear it
      const inputField = await this.driver.findElement(By.xpath('/html/body/div[1]/div/div/div/div[2]/div/div/div/div[1]/div[1]/div[2]/div/div/div[2]/div/div/div/div/div[1]/div/div/div[1]/div/div[1]/div/textarea'));
      await inputField.clear();

      // Simulate typing each character with a delay to prevent missing input
      for (let char of input) {
        await inputField.sendKeys(char);
        await this.delay(10);  // Adjust the delay as necessary
      }

      // Locate and click the button
      const sendButton = await this.driver.findElement(By.className('x1lliihq x2lah0s x1k90msu x2h7rmj x1qfuztq xtk6v10 xxk0z11 xvy4d1p'));
      await sendButton.click();

      // Wait for the response to be available (wait for table to appear)
      await this.driver.wait(until.elementLocated(By.xpath('//table')), 10000);  // Wait for the <table> to be loaded
      await this.delay(2000);  // Wait 2 seconds for table to load
    } catch (error) {
      console.error('Error submitting the query:', error);
    }
  }

  async getGenderAndReligionForName(name, table) {
    try {
      let retries = 0;
      let result = null;

      while (retries < 3 && !result) {
        // Wait for the table to be fully loaded
        const resultTable = await this.driver.findElement(By.xpath('//table'));  // Locate the <table>
        const rows = await resultTable.findElements(By.xpath('.//tr'));  // Get all rows in the table
        // Loop through each row and check if the name matches
        for (let row of rows) {
          const cells = await row.findElements(By.xpath('.//td'));  // Get the columns of the row

          // Ensure there are at least 4 <td> elements in the row (3 for gender and religion)
          if (cells.length >= 4) {
            const nameInTable = await cells[1].getText();  // Name is in the second <td>
            const gender = await cells[2].getText();  // Gender is in the third <td>
            const religion = await cells[3].getText();  // Religion is in the fourth <td>

            // If the name matches, add to table and return result
            if (nameInTable.trim() === name) {
              console.log(`Found name: ${nameInTable}, gender: ${gender}, religion: ${religion}`);
              table.push([table.length + 1, nameInTable, gender.trim(), religion.trim()]);
              result = [nameInTable, gender.trim(), religion.trim()];
              break;
            }
          }
        }
        // If no match found, wait 2 seconds and retry
        if (!result) {
          retries++;
          console.log(`Retry ${retries}: Searching for ${name} again...`);
          await this.delay(2000);
        }
      }

      // If still no match found, return null
      if (!result) {
        console.log(`No gender and religion found for ${name}`);
        return null;
      }

    } catch (error) {
      console.error('Error fetching gender and religion results for name:', error);
      return null;
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  saveResultsToFile() {
    const ws = XLSX.utils.aoa_to_sheet(this.processedResults);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'scraped_data.xlsx');  // Save to Excel
    console.log('Results saved to scraped_data.xlsx');
  }
}

(async () => {
  try {
    // Setup Chrome driver (update the path to the ChromeDriver executable if needed)
    const chromeCapabilities = Capabilities.chrome();
    chromeCapabilities.setPageLoadStrategy('normal');  // Use 'normal' for full page load, 'eager' for DOMContentLoaded, or 'none' for no waiting
    const driver = await new Builder().forBrowser('chrome').setChromeOptions(chromeCapabilities).build();

    // Start scraping process with Selenium
    const scraper = new MetaAIScraper(driver, 'https://meta.ai');  // Replace with your target URL
    await scraper.startScraping();

    // Close the browser
    driver.quit();
    console.log('Browser closed. Program finished.');

  } catch (error) {
    console.error('Error during Selenium setup or scraping:', error);
  }
})();
