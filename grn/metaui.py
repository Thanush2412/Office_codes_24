import customtkinter as ctk
import pandas as pd
from tkinter import filedialog, messagebox
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import queue

# Import selenium-stealth to make the browser less detectable
from selenium_stealth import stealth

class MetaAIScraper:
    def __init__(self):
        # Initialize Chrome WebDriver with headless options
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')

        # Start ChromeDriver and apply stealth mode
        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options
        )

        # Apply stealth to avoid detection
        stealth(self.driver,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                languages=["en-US", "en"],
                timezone_offset=-180,
                platform="Win32",
                webgl_vendor="Intel Inc.",
                renderer="Intel Iris OpenGL Engine",
                fix_hairline=True
        )

        self.url = "https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat&duckai=1"  # Update to Meta AI URL
        self.driver.get(self.url)
        time.sleep(3)  # Initial load time
        
        # Store processed results and progress
        self.processed_results = []
        self.progress_queue = queue.Queue()
        self.processing = False
        
        # Initialize the tkinter window
        self.app = ctk.CTk()
        self.app.title("ChatGPT Name Gender Scraper")
        self.app.geometry("800x800")

        # Create main components
        self.create_main_components()

    def create_main_components(self):
        """Create all main UI components"""
        # Input method selection
        self.input_method_var = ctk.StringVar(value="file")
        self.create_input_method_selection()
        
        # File and manual input areas
        self.create_file_selection_widgets()
        self.create_manual_input_widgets()
        
        # Progress tracking
        self.create_progress_bar()
        
        # Results display
        self.create_results_display()
        
        # Save options
        self.create_save_buttons()
        
        # Stop button
        self.create_stop_button()

    def create_stop_button(self):
        """Create stop button for halting name processing"""
        self.stop_button = ctk.CTkButton(
            self.app,
            text="Stop Processing",
            command=self.stop_processing,
            state="disabled",
            fg_color="red",
            hover_color="darkred"
        )
        self.stop_button.pack(pady=5)

    def create_progress_bar(self):
        """Create progress bar for tracking scraping progress"""
        self.progress_frame = ctk.CTkFrame(self.app)
        self.progress_frame.pack(pady=10, padx=20, fill="x")

        self.progress_label = ctk.CTkLabel(self.progress_frame, text="Progress:")
        self.progress_label.pack(side="left", padx=5)

        self.progress_bar = ctk.CTkProgressBar(self.progress_frame, width=500)
        self.progress_bar.pack(side="left", padx=10, expand=True, fill="x")
        self.progress_bar.set(0)

        self.progress_percentage = ctk.CTkLabel(self.progress_frame, text="0%")
        self.progress_percentage.pack(side="left", padx=5)

    def create_input_method_selection(self):
        """Create radio buttons for selecting input method"""
        method_frame = ctk.CTkFrame(self.app)
        method_frame.pack(pady=10)

        file_radio = ctk.CTkRadioButton(
            method_frame,
            text="File Input",
            variable=self.input_method_var,
            value="file",
            command=self.toggle_input_method
        )
        file_radio.pack(side="left", padx=10)

        manual_radio = ctk.CTkRadioButton(
            method_frame,
            text="Manual Input",
            variable=self.input_method_var,
            value="manual",
            command=self.toggle_input_method
        )
        manual_radio.pack(side="left", padx=10)

    def create_file_selection_widgets(self):
        """Create widgets for file input method"""
        self.file_frame = ctk.CTkFrame(self.app)
        self.file_frame.pack(pady=10)

        self.input_label = ctk.CTkLabel(
            self.file_frame,
            text="Select a CSV or Excel file with names:"
        )
        self.input_label.pack(pady=5)

        self.file_button = ctk.CTkButton(
            self.file_frame,
            text="Select File",
            command=self.on_file_select
        )
        self.file_button.pack(pady=5)

    def create_manual_input_widgets(self):
        """Create widgets for manual name input"""
        self.manual_frame = ctk.CTkFrame(self.app)

        self.manual_input_label = ctk.CTkLabel(
            self.manual_frame,
            text="Enter names (one per line):"
        )
        self.manual_input_label.pack(pady=5)

        self.manual_input_text = ctk.CTkTextbox(
            self.manual_frame,
            width=400,
            height=100
        )
        self.manual_input_text.pack(pady=5)

        self.manual_process_button = ctk.CTkButton(
            self.manual_frame,
            text="Process Names",
            command=self.process_manual_names
        )
        self.manual_process_button.pack(pady=5)

        # Initially hide manual input frame
        self.manual_frame.pack_forget()

    def create_results_display(self):
        """Create results display area"""
        self.result_text = ctk.CTkTextbox(self.app, width=600, height=200)
        self.result_text.pack(pady=10)
        self.result_text.configure(state="disabled")

    def create_save_buttons(self):
        """Create buttons to save results"""
        self.save_frame = ctk.CTkFrame(self.app)
        self.save_frame.pack(pady=10)

        self.save_csv_button = ctk.CTkButton(
            self.save_frame,
            text="Save as CSV",
            command=self.save_results_csv,
            state="disabled"
        )
        self.save_csv_button.pack(side="left", padx=5)

        self.save_excel_button = ctk.CTkButton(
            self.save_frame,
            text="Save as Excel",
            command=self.save_results_excel,
            state="disabled"
        )
        self.save_excel_button.pack(side="left", padx=5)

    def toggle_input_method(self):
        """Toggle between file and manual input methods"""
        if self.input_method_var.get() == "file":
            self.file_frame.pack(pady=10)
            self.manual_frame.pack_forget()
        else:
            self.file_frame.pack_forget()
            self.manual_frame.pack(pady=10)

    def stop_processing(self):
        """Stop the current processing operation"""
        self.processing = False
        self.stop_button.configure(state="disabled")
        self.update_result_text("\nProcessing stopped by user.\n")

    def process_manual_names(self):
        """Process names from manual input"""
        names = self.manual_input_text.get("1.0", "end").strip().split("\n")
        names = [name.strip() for name in names if name.strip()]
        
        if names:
            self.process_names(names)
        else:
            messagebox.showwarning("Warning", "No names entered!")

    def clean_name(self, name):
        """Clean name (remove extra spaces, handle edge cases)"""
        return name.strip() if name else ""

    def on_file_select(self):
        """Handle file selection for input names."""
        file_path = filedialog.askopenfilename(
            filetypes=[("CSV Files", "*.csv"), ("Excel Files", "*.xlsx")],
            title="Select a file"
        )
        
        if file_path:
            # Load names from the selected file
            if file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
                names = df.iloc[:, 0].tolist()  # Assuming names are in the first column
            elif file_path.endswith('.xlsx'):
                df = pd.read_excel(file_path)
                names = df.iloc[:, 0].tolist()  # Assuming names are in the first column
            else:
                messagebox.showerror("Error", "Unsupported file format!")
                return
            
            # Process the names
            self.process_names(names)

    def process_names(self, names):
        """Process names and scrape gender information."""
        self.processing = True
        self.stop_button.configure(state="normal")
        
        # Filter out empty names after cleaning
        valid_names = [self.clean_name(name) for name in names if self.clean_name(name)]
        
        # Process names in batches
        for name in valid_names:
            if not self.processing:  # Check if processing has been stopped
                break
                        # Create a prompt for the AI model
            search_query = f"{name} give me this input by name and gender on table"
            
            # Open Meta AI website and input the search query
            self.driver.get("https://duckduckgo.com/?q=DuckDuckGo+AI+Chat&ia=chat&duckai=1")  # Ensure the correct URL is used
            time.sleep(3)  # Wait for the page to load
            
            # Find the textarea by its placeholder or another attribute
            search_box = self.driver.find_element(By.XPATH, "//textarea[@placeholder='Ask Meta AI anything...']")
            search_box.send_keys(search_query)
            search_box.send_keys(Keys.RETURN)  # Press Enter to submit the search
            
            # Wait for the search results to load
            time.sleep(15)  # Adjust this time as necessary
            
            # Extract the page source and parse it with BeautifulSoup
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            table = soup.find('table')  # Find the first table on the page
            
            # Check if a table exists
            if table:
                rows = table.find_all('tr')
                for row in rows:
                    columns = row.find_all('td')
                    if columns:
                        # Assuming name is in the first column and gender in the second column
                        scraped_name = columns[0].text.strip()
                        gender = columns[1].text.strip()
                        self.processed_results.append((scraped_name, gender))
                        self.update_result_text(f"Name: {scraped_name}, Gender: {gender}\n")
            else:
                self.update_result_text(f"No results found for {name}.\n")

            # Update progress bar
            self.progress_bar.set((valid_names.index(name) + 1) / len(valid_names))
            self.progress_percentage.configure(text=f"{int((valid_names.index(name) + 1) / len(valid_names) * 100)}%")

        self.enable_post_processing_features()
        self.processing = False
        self.stop_button.configure(state="disabled")

    def update_result_text(self, text):
        """Update the results display area."""
        self.result_text.configure(state="normal")
        self.result_text.insert("end", text)
        self.result_text.configure(state="disabled")
        self.result_text.yview("end")  # Scroll to the end

    def enable_post_processing_features(self):
        """Enable buttons after processing"""
        self.save_csv_button.configure(state="normal")
        self.save_excel_button.configure(state="normal")

    def save_results_csv(self):
        """Save results as CSV"""
        if not self.processed_results:
            messagebox.showwarning("No results", "No data to save!")
            return

        # Prompt user to select a location to save the file
        file_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV Files", "*.csv")],
            title="Save Results as CSV"
        )

        if file_path:
            # Convert processed results to a DataFrame and save as CSV
            df = pd.DataFrame(self.processed_results, columns=["Name", "Gender"])
            try:
                df.to_csv(file_path, index=False)
                messagebox.showinfo("Success", f"Results saved to {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"An error occurred while saving the file: {e}")

    def save_results_excel(self):
        """Save results as Excel"""
        if not self.processed_results:
            messagebox.showwarning("No results", "No data to save!")
            return

        # Prompt user to select a location to save the file
        file_path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel Files", "*.xlsx")],
            title="Save Results as Excel"
        )

        if file_path:
            # Convert processed results to a DataFrame and save as Excel
            df = pd.DataFrame(self.processed_results, columns=["Name", "Gender"])
            try:
                df.to_excel(file_path, index=False)
                messagebox.showinfo("Success", f"Results saved to {file_path}")
            except Exception as e:
                messagebox.showerror("Error", f"An error occurred while saving the file: {e}")

    def run(self):
        """Run the application"""
        self.app.mainloop()

if __name__ == "__main__":
    scraper = MetaAIScraper()
    scraper.run()

    