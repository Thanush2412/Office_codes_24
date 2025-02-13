from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time

# Get the search query from the user
search_query = input("Enter the search query: ")

# Set up Chrome options (optional)
chrome_options = Options()
# Run in the background without opening the browser window

# Use webdriver-manager to automatically get the right chromedriver
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

# Open Meta AI website
driver.get("https://meta.ai")  # You can update the URL if needed

# Give time for the page to load
time.sleep(3)

# Find the textarea by its placeholder or another attribute (like in your original request)
search_box = driver.find_element(By.XPATH, "//textarea[@placeholder='Ask Meta AI anything...']")

# Input the user's search query into the textarea
search_box.send_keys(search_query + "give me this input by name and gender on table")

# Press Enter to submit the search
search_box.send_keys(Keys.RETURN)

# Wait for the search results to load
time.sleep(15)  # Give it more time if needed depending on the page response

# Extract the page source
soup = BeautifulSoup(driver.page_source, "html.parser")

# Example: Extracting a table with name and gender columns (assuming there's a table with those columns)
table = soup.find('table')  # Finds the first table on the page

# Check if a table exists
if table:
    # Iterate through rows and extract the data
    rows = table.find_all('tr')
    
    for row in rows:
        columns = row.find_all('td')
        if columns:
            # Assuming name is in the first column and gender in the second column
            name = columns[0].text.strip()
            gender = columns[1].text.strip()
            print(f"Name: {name}, Gender: {gender}")
else:
    print("No table found on the page.")

# Close the WebDriver
driver.quit()
