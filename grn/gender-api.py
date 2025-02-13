import re
import customtkinter as ctk
import pandas as pd
from tkinter import filedialog, messagebox, ttk
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import time
import threading
import queue
from bs4 import BeautifulSoup

class MetaAIScraper:
    def __init__(self):
        # Initialize Chrome WebDriver and open Meta AI
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
        self.url = "https://meta.ai"
        self.driver.get(self.url)

        # Store processed results and progress
        self.processed_results = []
        self.progress_queue = queue.Queue()
        self.processing = False
        self.current_thread = None

        # Initialize the tkinter window
        self.app = ctk.CTk()
        self.app.title("Meta AI Name Gender Scraper")
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

        # Save buttons
        self.create_save_buttons()

        # Stop button
        self.create_stop_button()

        # Column selection variable
        self.column_selection_var = ctk.StringVar()

    def create_results_display(self):
        """Create results display area using Treeview widget"""
        self.results_frame = ctk.CTkFrame(self.app)
        self.results_frame.pack(pady=10, padx=20, fill="x")

        # Treeview for displaying names and gender
        self.tree = ttk.Treeview(self.results_frame, columns=("Name", "Gender"), show="headings")
        self.tree.heading("Name", text="Name")
        self.tree.heading("Gender", text="Gender")
        self.tree.pack(pady=5)

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

    def create_save_buttons(self):
        """Create Save buttons for saving the processed results"""
        self.save_frame = ctk.CTkFrame(self.app)
        self.save_frame.pack(pady=10)

        # Create Save as CSV button
        self.save_csv_button = ctk.CTkButton(
            self.save_frame,
            text="Save as CSV",
            command=self.save_results_csv
        )
        self.save_csv_button.pack(side="left", padx=10)

        # Create Save as Excel button
        self.save_excel_button = ctk.CTkButton(
            self.save_frame,
            text="Save as Excel",
            command=self.save_results_excel
        )
        self.save_excel_button.pack(side="left", padx=10)

    def toggle_input_method(self):
        """Toggle between file and manual input methods"""
        if self.input_method_var.get() == "file":
            self.file_frame.pack(pady=10)
            self.manual_frame.pack_forget()
        else:
            self.file_frame.pack_forget()
            self.manual_frame.pack(pady=10)

    def update_result_text(self, text):
        """This function updates the results using Treeview instead of a text box"""
        # Insert the new result into the Treeview widget directly
        # Assuming you want to add this as a row in the Treeview
        self.tree.insert("", "end", values=(text, ""))  # You can adjust this based on your needs

    def stop_processing(self):
        """Stop the current processing operation"""
        self.processing = False
        self.stop_button.configure(state="disabled")
        self.update_result_text("\nProcessing stopped by user.\n")

    def process_manual_names(self):
        """Process manually entered names to determine gender in batches"""
        # Get the input text from the manual input text box
        names_input = self.manual_input_text.get("1.0", "end-1c").strip()

        if not names_input:
            self.update_result_text("No names provided.\n")
            return

        # Split the input text into lines (one name per line)
        names_list = [name.strip() for name in names_input.splitlines() if name.strip()]

        if names_list:
            # Update result text with names to be processed
            self.update_result_text(f"Processing the following names:\n{', '.join(names_list[:150])}\n")

            # Limit to 250 names for the first batch
            batch_size = 150
            self.processing = True
            self.stop_button.configure(state="normal")

            # Split the names into batches
            name_batches = [names_list[i:i + batch_size] for i in range(0, len(names_list), batch_size)]

            # Process the first batch (max 250 names) and add remaining batches to the queue
            first_batch = name_batches.pop(0)
            self.process_names_batch(first_batch)

            # Queue the remaining batches
            for remaining_batch in name_batches:
                self.progress_queue.put({'batch': remaining_batch})

            # Start processing any queued batches
            self.current_thread = threading.Thread(target=self.process_queued_batches_in_thread)
            self.current_thread.start()
        else:
            self.update_result_text("Invalid input. Please provide names to process.\n")

    def process_queued_batches_in_thread(self):
        """Process the remaining batches in the queue"""
        while not self.progress_queue.empty() and self.processing:
            batch = self.progress_queue.get()
            if batch.get('batch'):
                self.process_names_batch(batch['batch'])

        self.processing = False
        self.stop_button.configure(state="disabled")

    def process_names_batch(self, names_batch):
        """Process a batch of names by entering search query and extracting results from the table"""
        search_query = ", ".join(names_batch)  # Combine all names into a single query
        try:
            search_box = self.driver.find_element(By.XPATH, "//textarea[@placeholder='Ask Meta AI anything...']")
            search_box.send_keys("Give me the following name and gender in table" )
            search_box.send_keys(Keys.RETURN)
            time.sleep (5)
            # Find the search box and enter the search query
            search_box = self.driver.find_element(By.XPATH, "//textarea[@placeholder='Ask Meta AI anything...']")
            search_box.send_keys(f"{search_query} ")
            search_box.send_keys(Keys.RETURN)

            # Wait for the search results to load
            time.sleep(15)  # Adjust the sleep time if needed for better synchronization

            # Extract the page source and parse with BeautifulSoup
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            table = soup.find('table')  # Find the first table on the page

            # Extract name and gender from the table
            rows = table.find_all('tr')[1:]  # Skip the header row
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 2:  # Ensure there are at least 2 columns (name and gender)
                    name = cols[0].text.strip()  # Extract the name
                    gender = cols[1].text.strip()  # Extract the gender
                    self.processed_results.append((name, gender))

                    # Insert the result into the Treeview widget
                    self.tree.insert("", "end", values=(name, gender))

                    # Update progress and UI
                    progress = len(self.processed_results) / len(names_batch)
                    self.progress_queue.put({
                        'progress': progress,
                        'current_name': name,
                        'processed': len(self.processed_results),
                        'total': len(names_batch),
                        'gender': gender
                    })

        except Exception as e:
            print(f"Error processing batch: {e}")

    def track_progress(self):
        """Track and update progress in real-time"""
        try:
            while True:
                try:
                    update = self.progress_queue.get_nowait()

                    if update.get('complete', False):
                        self.progress_bar.set(1)
                        self.progress_percentage.configure(text="100%")
                        return

                    progress = update['progress']
                    self.progress_bar.set(progress)
                    percentage = int(progress * 100)
                    self.progress_percentage.configure(text=f"{percentage}%")

                    self.update_processing_text(
                        update['current_name'],
                        update['processed'],
                        update['total']
                    )

                except queue.Empty:
                    break

        except Exception as e:
            print(f"Progress tracking error: {e}")

        self.app.after(100, self.track_progress)

    def update_processing_text(self, current_name, processed, total):
        """Update the text display with current name being processed"""
        self.update_result_text(f"Processing {current_name} ({processed}/{total})\n")

    def save_results_csv(self):
        """Save the processed results as a CSV file"""
        df = pd.DataFrame(self.processed_results, columns=["Name", "Gender"])
        file_path = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=(("CSV Files", "*.csv"), ("All Files", "*.*")))
        if file_path:
            df.to_csv(file_path, index=False)
            messagebox.showinfo("Saved", f"Results saved to {file_path}")

    def save_results_excel(self):
        """Save the processed results as an Excel file"""
        df = pd.DataFrame(self.processed_results, columns=["Name", "Gender"])
        file_path = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=(("Excel Files", "*.xlsx"), ("All Files", "*.*")))
        if file_path:
            df.to_excel(file_path, index=False)
            messagebox.showinfo("Saved", f"Results saved to {file_path}")

    def on_file_select(self):
        """Handle file selection for CSV or Excel files"""
        file_path = filedialog.askopenfilename(filetypes=[("CSV Files", "*.csv"), ("Excel Files", "*.xlsx")])
        if file_path:
            if file_path.endswith(".csv"):
                self.process_file_csv(file_path)
            elif file_path.endswith(".xlsx"):
                self.process_file_excel(file_path)

    def process_file_csv(self, file_path):
        """Process a CSV file and extract names"""
        df = pd.read_csv(file_path)
        # Assume names are in the first column, adjust as needed
        names = df.iloc[:, 0].tolist()
        self.process_names_batch(names)

    def process_file_excel(self, file_path):
        """Process an Excel file and extract names"""
        df = pd.read_excel(file_path)
        # Assume names are in the first column, adjust as needed
        names = df.iloc[:, 0].tolist()
        self.process_names_batch(names)

if __name__ == "__main__":
    scraper = MetaAIScraper()
    scraper.app.mainloop()
