import customtkinter as ctk
from tkinter import filedialog, messagebox, Scrollbar, Text
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
from bs4 import BeautifulSoup
import time
import json
import os
from datetime import datetime
import threading
from queue import Queue
import concurrent.futures
from plyer import notification

def get_icon_path():
    """Get icon paths relative to script location"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons = {
        'taskbar': os.path.join(script_dir, 'icon.ico'),
        'notification': os.path.join(script_dir, 'icon.ico')
    }
    return icons

class LeetcodeScraper:
    def __init__(self):
        self.root = ctk.CTk()
        self.root.title("Leetcode Scraper")
        self.root.geometry("800x600")
        
        # Configure appearance
        ctk.set_appearance_mode("System")
        ctk.set_default_color_theme("blue")
        
        # Set application icons
        self.icons = get_icon_path()
        self.root.iconbitmap(default=self.icons['taskbar'])

        self.df = None
        self.current_url_index = 0
        self.total_urls = 0
        self.processed_urls = 0
        self.results = []
        self.url_queue = Queue()
        self.result_queue = Queue()
        self.is_scraping = False
        self.is_paused = False
        self.setup_ui()
        self.driver = None
        self.results_log_file = os.path.join(os.getcwd(), "scraped_results.log")
        self.create_log_file()
        
        # Bind window close event
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def setup_ui(self):
        # File selection frame
        self.file_frame = ctk.CTkFrame(self.root)
        self.file_frame.pack(fill='x', padx=20, pady=10)
        
        self.file_button = ctk.CTkButton(
            self.file_frame,
            text="Select Excel/CSV File",
            command=self.select_file
        )
        self.file_button.pack(side='left', padx=10)
        
        self.file_label = ctk.CTkLabel(
            self.file_frame,
            text="No file selected",
            text_color="gray"
        )
        self.file_label.pack(side='left', padx=10)
        
        # Column selection frame
        self.column_frame = ctk.CTkFrame(self.root)
        self.column_frame.pack(fill='x', padx=20, pady=10)
        
        self.column_label = ctk.CTkLabel(
            self.column_frame,
            text="Select URL Column:",
            text_color="gray"
        )
        self.column_label.pack(side='left', padx=10)
        
        self.column_dropdown = ctk.CTkOptionMenu(
            self.column_frame,
            values=["Select a file first"],
            state="disabled"
        )
        self.column_dropdown.pack(side='left', padx=10)
        
        # Progress bar frame
        self.progress_frame = ctk.CTkFrame(self.root)
        self.progress_frame.pack(fill='x', padx=20, pady=10)
        
        self.progress_bar = ctk.CTkProgressBar(
            self.progress_frame,
            width=700
        )
        self.progress_bar.pack(pady=10)
        self.progress_bar.set(0)
        
        self.progress_label = ctk.CTkLabel(
            self.progress_frame,
            text="0/0 URLs processed (0%)",
            text_color="gray"
        )
        self.progress_label.pack()
        
        # Save options frame
        self.save_frame = ctk.CTkFrame(self.root)
        self.save_frame.pack(fill='x', padx=20, pady=10)
        
        self.save_dir_label = ctk.CTkLabel(
            self.save_frame,
            text="Save Directory:",
            text_color="gray"
        )
        self.save_dir_label.pack(side='left', padx=10)
        
        self.save_dir_entry = ctk.CTkEntry(
            self.save_frame,
            width=300
        )
        self.save_dir_entry.pack(side='left', padx=10)
        self.save_dir_entry.insert(0, os.path.join(os.getcwd(), "leetcode_results"))
        
        self.browse_dir_button = ctk.CTkButton(
            self.save_frame,
            text="Browse",
            command=self.select_save_directory
        )
        self.browse_dir_button.pack(side='left', padx=10)
        
        # File name frame
        self.filename_frame = ctk.CTkFrame(self.root)
        self.filename_frame.pack(fill='x', padx=20, pady=10)
        
        self.filename_label = ctk.CTkLabel(
            self.filename_frame,
            text="Excel Filename:",
            text_color="gray"
        )
        self.filename_label.pack(side='left', padx=10)
        
        self.filename_entry = ctk.CTkEntry(
            self.filename_frame,
            width=300
        )
        self.filename_entry.pack(side='left', padx=10)
        self.filename_entry.insert(0, "leetcode_results.xlsx")
        
        # Results display
        self.result_text = ctk.CTkTextbox(
            self.root,
            wrap='word',
            height=300
        )
        self.result_text.pack(padx=20, pady=10, fill='both', expand=True)
        
        # Control buttons frame
        self.control_frame = ctk.CTkFrame(self.root)
        self.control_frame.pack(fill='x', padx=20, pady=10)
        
        # Start button
        self.start_button = ctk.CTkButton(
            self.control_frame,
            text="Start Scraping",
            command=self.start_scraping,
            state="disabled"
        )
        self.start_button.pack(side='left', padx=10)
        
        # Pause button
        self.pause_button = ctk.CTkButton(
            self.control_frame,
            text="Pause",
            command=self.toggle_pause,
            state="disabled"
        )
        self.pause_button.pack(side='left', padx=10)
        
        # Stop button
        self.stop_button = ctk.CTkButton(
            self.control_frame,
            text="Stop",
            command=self.stop_scraping,
            state="disabled"
        )
        self.stop_button.pack(side='left', padx=10)
        
        # Auto-save status
        self.autosave_label = ctk.CTkLabel(
            self.control_frame,
            text="Auto-saving enabled",
            text_color="green"
        )
        self.autosave_label.pack(side='right', padx=10)

    def toggle_pause(self):
        """Toggle between pause and resume states"""
        self.is_paused = not self.is_paused
        if self.is_paused:
            self.pause_button.configure(text="Resume")
            self.log_message("Scraping paused")
            self.show_notification("Scraping Paused", "The scraping process has been paused")
        else:
            self.pause_button.configure(text="Pause")
            self.log_message("Scraping resumed")
            self.show_notification("Scraping Resumed", "The scraping process has been resumed")

    def stop_scraping(self):
        """Stop the scraping process"""
        if messagebox.askyesno("Confirm Stop", "Are you sure you want to stop scraping? Progress will be saved."):
            # Wait for any in-progress scraping to complete
            time.sleep(1)
            self.is_scraping = False
            
            # Ensure result queue is empty
            while not self.result_queue.empty():
                result = self.result_queue.get()
                self.results.append(result)
            
            # Final save
            self.save_to_excel()
            self.log_message("Scraping stopped manually")
            self.show_notification("Scraping Stopped", "The scraping process has been stopped and progress saved")
            self.reset_ui_state()

    def reset_ui_state(self):
        """Reset UI elements to their initial state"""
        self.start_button.configure(state="normal")
        self.pause_button.configure(state="disabled", text="Pause")
        self.stop_button.configure(state="disabled")
        self.is_paused = False
        if self.driver:
            self.driver.quit()
            self.driver = None

    def on_closing(self):
        """Handle window closing event"""
        if self.is_scraping:
            if messagebox.askyesno("Confirm Exit", "Scraping is in progress. Do you want to save and exit?"):
                self.is_scraping = False
                self.save_to_excel()
                self.log_message("Scraping stopped due to application close")
                self.show_notification("Scraping Stopped", "The scraping process has been stopped and progress saved")
                if self.driver:
                    self.driver.quit()
                self.root.destroy()
        else:
            self.root.destroy()

    def show_notification(self, title, message):
        """Show system notification with icon"""
        try:
            notification.notify(
                title=title,
                message=message,
                app_icon=self.icons.get('notification'),
                timeout=10,
            )
        except Exception as e:
            self.log_message(f"Failed to show notification: {str(e)}")

    def update_progress(self):
        """Update the progress bar and label"""
        if self.total_urls > 0:
            progress = self.processed_urls / self.total_urls
            percentage = round(progress * 100, 1)
            self.progress_bar.set(progress)
            self.progress_label.configure(
                text=f"{self.processed_urls}/{self.total_urls} URLs processed ({percentage}%)"
            )

            # When 100% is reached, show the completion notification
            if percentage == 100:
                self.show_notification("Scraping Completed", f"Successfully scraped {self.processed_urls} URLs")


    def create_log_file(self):
        """Create or clear the log file at the start"""
        with open(self.results_log_file, 'w') as f:
            f.write("Scraping Log\n")
            f.write(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

    def append_log_file(self, message):
        """Append message to the log file"""
        with open(self.results_log_file, 'a') as f:
            f.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {message}\n")

    def log_message(self, message):
        """Log message to the UI"""
        self.root.after(0, lambda: self._log_message(message))
    
    def _log_message(self, message):
        """Internal method to update the text widget"""
        self.result_text.insert('end', f"{message}\n")
        self.result_text.see('end')

    def select_save_directory(self):
        """Select directory to save results"""
        directory = filedialog.askdirectory(title="Select Save Directory")
        if directory:
            self.save_dir_entry.delete(0, 'end')
            self.save_dir_entry.insert(0, directory)

    def select_file(self):
        """Select input file with URLs"""
        file_path = filedialog.askopenfilename(
            title="Select File",
            filetypes=[("Excel Files", "*.xlsx;*.xls"), ("CSV Files", "*.csv")]
        )
        if file_path:
            self.load_file(file_path)

    def load_file(self, file_path):
        """Load the selected file"""
        try:
            if file_path.endswith(('.xlsx', '.xls')):
                self.df = pd.read_excel(file_path)
            else:
                self.df = pd.read_csv(file_path)
                
            self.file_label.configure(text=f"Selected: {os.path.basename(file_path)}")
            self.column_dropdown.configure(
                values=list(self.df.columns),
                state="normal"
            )
            self.column_dropdown.set(self.df.columns[0])
            self.start_button.configure(state="normal")
            self.current_url_index = 0
            self.results = []
            
        except Exception as e:
            messagebox.showerror("Error", f"Error loading file: {e}")

    def wait_for_page_load(self, driver, url):
        """Wait for the page to load completely with exponential backoff"""
        max_attempts = 3
        base_wait = 2
        for attempt in range(max_attempts):
            try:
                wait_time = base_wait * (2 ** attempt)
                self.log_message(f"Waiting {wait_time} seconds for page to load...")
                WebDriverWait(driver, wait_time).until(
                    EC.presence_of_element_located((By.CLASS_NAME, "text-xs"))
                )
                time.sleep(wait_time)
                return True
            except TimeoutException:
                self.log_message(f"Timeout on attempt {attempt + 1}/{max_attempts}")
                if attempt == max_attempts - 1:
                    raise
        return False

    def scrape_profile_data(self, driver, url):
        """Scrape data from a LeetCode profile page"""
        difficulty_classes = {
            "text-xs font-medium text-sd-easy": "Easy",
            "text-xs font-medium text-sd-medium": "Medium",
            "text-xs font-medium text-sd-hard": "Hard"
        }
        
        url_results = {'URL': url}
        soup = BeautifulSoup(driver.page_source, 'html.parser')
        
        for class_name, difficulty in difficulty_classes.items():
            elements = soup.find_all(class_=class_name)
            for element in elements:
                foreground_element = element.find_next_sibling(
                    class_="text-sd-foreground text-xs font-medium"
                )
                
                if foreground_element:
                    count = foreground_element.get_text(strip=True)
                    # Extract number before slash
                    solved_count = count.split('/')[0]
                    url_results[difficulty] = solved_count
                    self.log_message(f"Found {difficulty}: {solved_count} (from {count})")
                else:
                    url_results[difficulty] = "0"
                    self.log_message(f"No data found for {difficulty}")
                    
        return url_results

    def scrape_worker(self, driver):
        """Worker function for threaded scraping with retries"""
        max_retries = 3
        while True:
            while self.is_paused:
                time.sleep(1)
                if not self.is_scraping:
                    return

            try:
                url = self.url_queue.get_nowait()
            except:
                if not self.is_scraping:
                    return
                time.sleep(0.1)
                continue

            try:
                self.processed_urls += 1
                self.root.after(0, self.update_progress)
                self.log_message(f"\nProcessing URL {self.processed_urls}/{self.total_urls}: {url}")
                driver.get(url)
                
                if self.wait_for_page_load(driver, url):
                    retry_count = 0
                    while retry_count < max_retries:
                        try:
                            url_results = self.scrape_profile_data(driver, url)
                            if url_results:
                                self.result_queue.put(url_results)
                                self.append_log_file(f"Scraped {url} successfully.")
                                self.log_message(f"Added result to queue: {url_results}")
                                self.save_to_excel()
                                break
                        except WebDriverException as e:
                            if "GetHandleVerifier" in str(e):
                                retry_count += 1
                                self.log_message(f"Error scraping {url}, retrying... ({retry_count}/{max_retries})")
                                time.sleep(1)
                                driver.get(url)
                                time.sleep(2)
                            else:
                                raise
                    if retry_count == max_retries:
                        self.append_log_file(f"Failed to scrape {url} after {max_retries} retries.")
                        
            except Exception as e:
                self.log_message(f"Error processing {url}: {str(e)}")
                self.append_log_file(f"Error processing {url}: {str(e)}")
            finally:
                self.url_queue.task_done()

    def process_results(self):
        """Process results from the result queue"""
        while self.is_scraping or not self.result_queue.empty():  # Changed condition to check queue
            try:
                result = self.result_queue.get_nowait()
                self.results.append(result)
                self.log_message(f"Processed result: {result}")
                self.save_to_excel()  # Save after each result
            except:
                time.sleep(0.1)
                    
            

    def save_to_excel(self):
        """Save results to Excel file"""
        if not self.results:
            return
            
        save_dir = self.save_dir_entry.get()
        filename = self.filename_entry.get()
        if not filename.endswith('.xlsx'):
            filename += '.xlsx'
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
            
        excel_path = os.path.join(save_dir, filename)
        try:
            df_results = pd.DataFrame(self.results)
            
            # Convert all values to integers (except URL column)
            for col in df_results.columns:
                if col != 'URL':
                    df_results[col] = pd.to_numeric(df_results[col], errors='coerce').fillna(0).astype(int)
            
            df_results.to_excel(excel_path, index=False)
            self.log_message(f"Saved results to Excel: {excel_path}")
        except Exception as e:
            self.log_message(f"Error saving to Excel: {str(e)}")

    def start_scraping(self):
        """Start the scraping process"""
        column_name = self.column_dropdown.get()
        urls = self.df[column_name].dropna().tolist()
        
        if not urls:
            messagebox.showerror("Error", "No URLs found in selected column")
            return
        
        try:
            self.result_text.delete('1.0', 'end')
            self.log_message(f"Starting to scrape {len(urls)} URLs...")
            
            self.results = []
            self.is_scraping = True
            self.processed_urls = 0
            self.total_urls = len(urls)
            self.update_progress()
            
            # Enable control buttons
            self.start_button.configure(state="disabled")
            self.pause_button.configure(state="normal")
            self.stop_button.configure(state="normal")
            
            for url in urls:
                self.url_queue.put(url)
            
            chrome_options = webdriver.ChromeOptions()
            chrome_options.add_argument('--log-level=3')
            chrome_options.add_argument('--incongnito')
            self.driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()),
                options=chrome_options
            )
            
            num_threads = 1
            workers = []
            for _ in range(num_threads):
                worker = threading.Thread(target=self.scrape_worker, args=(self.driver,))
                worker.start()
                workers.append(worker)
                
            result_thread = threading.Thread(target=self.process_results)
            result_thread.start()
            
            def monitor_completion(self):
                # Wait for all URLs to be processed
                for worker in workers:
                    worker.join()

                # Wait for a short time to ensure last result is processed
                time.sleep(1)

                # Set scraping to false after ensuring all results are processed
                self.is_scraping = False

                # Wait for result thread to complete
                result_thread.join()

                # Final save to ensure nothing is missed
                self.save_to_excel()

                # Clean up
                self.driver.quit()
                
                # Show completion notification
                self.root.after(0, lambda: self.show_completion_notification())

            
            monitor_thread = threading.Thread(target=monitor_completion)
            monitor_thread.start()
        
        except Exception as e:
            self.is_scraping = False
            self.log_message(f"Error starting scraping: {str(e)}")
            messagebox.showerror("Error", f"Error starting scraping: {str(e)}")

    def show_completion_notification(self):
        """Show completion notification and message box"""
        self.show_notification(
            "Scraping Completed",
            f"Successfully scraped {self.processed_urls} URLs"
        )
        messagebox.showinfo(
            "Success",
            f"Scraping completed successfully!\nProcessed {self.processed_urls} URLs"
        )
        self.reset_ui_state()


# Run the app
if __name__ == "__main__":
    scraper = LeetcodeScraper()
    scraper.root.mainloop()