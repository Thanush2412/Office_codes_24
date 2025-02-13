import re
import customtkinter as ctk
import pandas as pd
from tkinter import filedialog, messagebox
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import threading
import os
import queue

class GenderizeScraper:
    def __init__(self):
        # Initialize Chrome WebDriver and open the Genderize.io website
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
        self.url = "https://genderize.io/"
        self.driver.get(self.url)

        # Store processed results and progress
        self.processed_results = []
        self.progress_queue = queue.Queue()
        self.processing = False
        self.current_thread = None
        
        # Initialize the tkinter window
        self.app = ctk.CTk()
        self.app.title("Genderize.io Interactive Scraper")
        self.app.geometry("800x800")

        # Create input method selection
        self.input_method_var = ctk.StringVar(value="file")
        self.create_input_method_selection()

        # File selection widgets
        self.create_file_selection_widgets()

        # Manual input widgets
        self.create_manual_input_widgets()

        # Progress bar
        self.create_progress_bar()

        # Results display
        self.create_results_display()

        # Save results buttons
        self.create_save_buttons()

        # Stop button
        self.create_stop_button()

        self.column_selection_var = ctk.StringVar()
        # Interaction prompt area
        self.create_interaction_prompt()
        
        # Clean Text Button
        self.create_clean_text_button()

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

    def stop_processing(self):
        """Stop the current processing operation"""
        self.processing = False
        self.stop_button.configure(state="disabled")
        
        # Update UI to show processing stopped
        self.result_text.configure(state="normal")
        self.result_text.insert("end", "\nProcessing stopped by user.\n")
        self.result_text.configure(state="disabled")
        self.result_text.yview_moveto(1)

    def create_progress_bar(self):
        """Create progress bar for tracking scraping progress"""
        self.progress_frame = ctk.CTkFrame(self.app)
        self.progress_frame.pack(pady=10, padx=20, fill="x")

        # Progress label
        self.progress_label = ctk.CTkLabel(self.progress_frame, text="Progress:")
        self.progress_label.pack(side="left", padx=5)

        # Actual progress bar
        self.progress_bar = ctk.CTkProgressBar(self.progress_frame, width=500)
        self.progress_bar.pack(side="left", padx=10, expand=True, fill="x")
        self.progress_bar.set(0)  # Initial state

        # Progress percentage label
        self.progress_percentage = ctk.CTkLabel(self.progress_frame, text="0%")
        self.progress_percentage.pack(side="left", padx=5)

    def create_clean_text_button(self):
        """Create a button to clean the text input."""
        self.clean_text_button = ctk.CTkButton(self.app, text="Clean Text", command=self.clean_manual_input)
        self.clean_text_button.pack(pady=10)

    def clean_manual_input(self):
        """Clean the text in the manual input textbox"""
        text = self.manual_input_text.get("1.0", "end").strip()
        names = text.split('\n')
        cleaned_names = self.clean_names(names)
        
        # Update textbox with cleaned names
        self.manual_input_text.delete("1.0", "end")
        self.manual_input_text.insert("1.0", '\n'.join(cleaned_names))

    def clean_name(self, name):
        """
        Cleans a single name by removing special characters, removing periods, 
        and standardizing format.
        Returns cleaned name or empty string if input is invalid.
        """
        try:
            if pd.isna(name) or not isinstance(name, (str, float, int)):
                return ""
            
            # Convert to string and clean
            name_str = str(name).strip()

            # Step 1: Remove periods (.) but keep spaces intact
            name_str = name_str.replace('.', ' ')

            # Step 2: Remove special characters except letters, spaces, and hyphens
            cleaned = re.sub(r'[^a-zA-Z\s-]', '', name_str)
            
            # Step 3: Replace multiple spaces with a single space
            cleaned = re.sub(r'\s+', ' ', cleaned)
            
            # Step 4: Remove single-letter words except initials followed by a period
            words = cleaned.split()
            cleaned_words = [word for word in words if len(word) > 1]
            
            return ' '.join(cleaned_words).strip()
        
        except Exception as e:
            print(f"Error cleaning name '{name}': {e}")
            return ""

    def clean_names(self, names):
        """
        Clean a list of names.
        Returns list of cleaned names.
        """
        cleaned_names = []
        
        for name in names:
            cleaned = self.clean_name(name)
            if cleaned:  # Add only non-empty cleaned names
                cleaned_names.append(cleaned)
                
        return cleaned_names
    
    def process_names_thread(self, names):
        """Thread for processing names to prevent UI freezing"""
        self.processing = True
        self.stop_button.configure(state="normal")
        
        # Clear previous results
        self.processed_results.clear()
        
        # Reset the result text
        self.app.after(0, lambda: self.update_result_text("Processing started...\n", clear=True))

        total_names = len(names)
        batch_size = 100  # Process names in batches of 100
        batches = [names[i:i + batch_size] for i in range(0, total_names, batch_size)]
        
        for batch_index, batch in enumerate(batches, 1):
            if not self.processing:
                break
                
            batch_message = f"\nProcessing batch {batch_index}/{len(batches)}...\n"
            self.app.after(0, lambda m=batch_message: self.update_result_text(m))
            
            for i, name in enumerate(batch, 1):
                if not self.processing:
                    break
                    
                result = self.get_gender_from_name(name)
                self.processed_results.append((name, result))
                
                # Update progress
                progress = (batch_index - 1) * batch_size + i
                self.progress_queue.put({
                    'progress': progress / total_names,
                    'current_name': name,
                    'processed': progress,
                    'total': total_names
                })
                
                # Update result text with current result
                result_message = f"{name}: {result}\n"
                self.app.after(0, lambda m=result_message: self.update_result_text(m))
            
            # Allow UI updates
            time.sleep(1)

        # Signal completion
        self.progress_queue.put({'complete': True})
        self.processing = False
        self.stop_button.configure(state="disabled")
        
        # Enable post-processing features
        self.app.after(0, self.enable_post_processing_features)

    def update_result_text(self, message, clear=False):
        """Update the result text widget"""
        self.result_text.configure(state="normal")
        if clear:
            self.result_text.delete("1.0", "end")
        self.result_text.insert("end", message)
        self.result_text.configure(state="disabled")
        self.result_text.yview_moveto(1)

    def create_input_method_selection(self):
        """Create radio buttons for selecting input method"""
        method_frame = ctk.CTkFrame(self.app)
        method_frame.pack(pady=10)

        file_radio = ctk.CTkRadioButton(method_frame, text="File Input", 
                                        variable=self.input_method_var, 
                                        value="file", 
                                        command=self.toggle_input_method)
        file_radio.pack(side="left", padx=10)

        manual_radio = ctk.CTkRadioButton(method_frame, text="Manual Input", 
                                          variable=self.input_method_var, 
                                          value="manual", 
                                          command=self.toggle_input_method)
        manual_radio.pack(side="left", padx=10)

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

    def create_file_selection_widgets(self):
        """Create widgets for file input method"""
        self.file_frame = ctk.CTkFrame(self.app)
        self.file_frame.pack(pady=10)

        self.input_label = ctk.CTkLabel(self.file_frame, text="Select a CSV or Excel file with a 'Name' column:")
        self.input_label.pack(pady=5)

        self.file_button = ctk.CTkButton(self.file_frame, text="Select File", command=self.on_file_select)
        self.file_button.pack(pady=5)

    def create_manual_input_widgets(self):
        """Create widgets for manual name input"""
        self.manual_frame = ctk.CTkFrame(self.app)

        self.manual_input_label = ctk.CTkLabel(self.manual_frame, text="Enter names (one per line):")
        self.manual_input_label.pack(pady=5)

        self.manual_input_text = ctk.CTkTextbox(self.manual_frame, width=400, height=100)
        self.manual_input_text.pack(pady=5)

        self.manual_process_button = ctk.CTkButton(self.manual_frame, text="Process Names", command=self.process_manual_names)
        self.manual_process_button.pack(pady=5)

        # Initially hide manual input frame
        self.manual_frame.pack_forget()

    def create_results_display(self):
        """Create results display area"""
        self.result_text = ctk.CTkTextbox(self.app, width=600, height=200)
        self.result_text.pack(pady=10)
        self.result_text.configure(state="disabled")

    def create_interaction_prompt(self):
        """Create interaction prompt area"""
        self.prompt_frame = ctk.CTkFrame(self.app)
        self.prompt_frame.pack(pady=10, fill="x", padx=20)

        self.prompt_label = ctk.CTkLabel(self.prompt_frame, text="Prompt:", font=("Helvetica", 12, "bold"))
        self.prompt_label.pack(side="left", padx=5)

        self.prompt_entry = ctk.CTkEntry(self.prompt_frame, width=400)
        self.prompt_entry.pack(side="left", padx=5, expand=True, fill="x")

        self.send_button = ctk.CTkButton(self.prompt_frame, text="Send", command=self.handle_interaction_prompt)
        self.send_button.pack(side="left", padx=5)

        # Initially disable prompt
        self.prompt_entry.configure(state="disabled")
        self.send_button.configure(state="disabled")

    def toggle_input_method(self):
        """Toggle between file and manual input methods"""
        if self.input_method_var.get() == "file":
            self.file_frame.pack(pady=10)
            self.manual_frame.pack_forget()
        else:
            self.file_frame.pack_forget()
            self.manual_frame.pack(pady=10)

    def on_file_select(self):
        """Handle file selection and processing"""
        file_path = filedialog.askopenfilename(filetypes=[("CSV Files", "*.csv"), ("Excel Files", "*.xlsx;*.xls")])
        
        if file_path:
            try:
                # Load the data from the selected file
                data = pd.read_csv(file_path) if file_path.endswith('.csv') else pd.read_excel(file_path)
                
                # Extract columns from the file and create a dropdown for selection
                columns = list(data.columns)
                
                # Create a new window to select the column
                self.column_select_window = ctk.CTkToplevel(self.app)
                self.column_select_window.title("Select Column")
                self.column_select_window.geometry("300x150")
                
                # Label for dropdown
                column_label = ctk.CTkLabel(self.column_select_window, text="Select column for names:")
                column_label.pack(pady=10)

                # Dropdown for columns
                self.column_selection_var.set(columns[0])  # Set default to first column
                column_dropdown = ctk.CTkOptionMenu(self.column_select_window, variable=self.column_selection_var, values=columns)
                column_dropdown.pack(pady=10)

                # Button to confirm selection
                confirm_button = ctk.CTkButton(self.column_select_window, text="Confirm", command=lambda: self.confirm_column_selection(data))
                confirm_button.pack(pady=10)
                
            except Exception as e:
                messagebox.showerror("Error", f"Error reading file: {e}")

    def confirm_column_selection(self, data):
        """Process names after column selection"""
        selected_column = self.column_selection_var.get()
        if selected_column in data.columns:
            names = data[selected_column].dropna().tolist()
            self.process_names(names)
            self.column_select_window.destroy()
        else:
            messagebox.showerror("Error", "Selected column does not exist.")

    def process_manual_names(self):
        """Process names from manual input"""
        names = self.manual_input_text.get("1.0", "end").strip().split("\n")
        names = [name.strip() for name in names if name.strip()]
        
        if names:
            self.process_names(names)
        else:
            messagebox.showwarning("Warning", "No names entered!")

    def process_names(self, names):
        """Process a list of names"""
        if self.processing:
            messagebox.showwarning("Warning", "Processing already in progress!")
            return
            
        # Clean and deduplicate names
        cleaned_names = self.clean_names(names)
        
        if not cleaned_names:
            messagebox.showwarning("Warning", "No valid names to process!")
            return
            
        # Show number of duplicates removed
        duplicates_removed = len(names) - len(cleaned_names)
        if duplicates_removed > 0:
            messagebox.showinfo("Duplicates Removed", 
                f"{duplicates_removed} duplicate or invalid names were removed.")
        
        # Reset UI state
        self.progress_bar.set(0)
        self.progress_percentage.configure(text="0%")
        self.save_csv_button.configure(state="disabled")
        self.save_excel_button.configure(state="disabled")

    # Clear previous results
        self.result_text.configure(state="normal")
        self.result_text.delete("1.0", "end")
        self.result_text.insert("end", "Processing names...\n")
        self.result_text.configure(state="disabled")

        # Start processing in a separate thread
        self.current_thread = threading.Thread(target=self.process_names_thread, args=(cleaned_names,), daemon=True)
        self.current_thread.start()

        # Start progress tracking
        self.track_progress()

    def save_results_csv(self):
        """Save results as CSV file"""
        if not self.processed_results:
            messagebox.showwarning("Warning", "No results to save!")
            return

        # Create DataFrame from processed results
        df = pd.DataFrame(self.processed_results, columns=['Name', 'Gender'])
        
        # Open save dialog
        save_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv")],
            initialdir=os.path.expanduser("~")
        )
        
        if save_path:
            try:
                df.to_csv(save_path, index=False)
                messagebox.showinfo("Success", f"Results saved to {save_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save file: {e}")

    def save_results_excel(self):
        """Save results as Excel file"""
        if not self.processed_results:
            messagebox.showwarning("Warning", "No results to save!")
            return

        # Create DataFrame from processed results
        df = pd.DataFrame(self.processed_results, columns=['Name', 'Gender'])
        
        # Open save dialog
        save_path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx")],
            initialdir=os.path.expanduser("~")
        )
        
        if save_path:
            try:
                df.to_excel(save_path, index=False)
                messagebox.showinfo("Success", f"Results saved to {save_path}")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to save file: {e}")

    def track_progress(self):
        """Track and update progress in real-time"""
        try:
            # Check if there are progress updates without blocking
            while True:
                try:
                    update = self.progress_queue.get_nowait()
                    
                    # Check if processing is complete
                    if update.get('complete', False):
                        self.progress_bar.set(1)
                        self.progress_percentage.configure(text="100%")
                        return
                    
                    # Update progress bar and percentage
                    progress = update['progress']
                    self.progress_bar.set(progress)
                    percentage = int(progress * 100)
                    self.progress_percentage.configure(text=f"{percentage}%")

                    # Update result text with current processing info
                    current_name = update.get('current_name', '')
                    processed = update.get('processed', 0)
                    total = update.get('total', 1)
                    self.update_processing_text(current_name, processed, total)

                except queue.Empty:
                    break
        except Exception as e:
            print(f"Progress tracking error: {e}")
        
        # Schedule next progress check
        self.app.after(100, self.track_progress)

    def update_processing_text(self, current_name, processed, total):
        """Update processing text in result display"""
        self.result_text.configure(state="normal")
        processing_text = f"Processing: {current_name} ({processed}/{total})\n"
        
        # Check if the last line is about processing
        last_line = self.result_text.get("end-2l", "end-1c")
        if not last_line.startswith("Processing:"):
            # Insert at the second-to-last line
            self.result_text.insert("end-1l", processing_text)
        else:
            # Replace the last processing line
            self.result_text.delete("end-2l", "end-1c")
            self.result_text.insert("end-1l", processing_text)
        
        self.result_text.configure(state="disabled")
        self.result_text.yview_moveto(1)

    def get_gender_from_name(self, name):
        """Get gender prediction for a given name from Genderize.io"""
        max_attempts = 3  # Maximum number of attempts for each name
        
        for attempt in range(max_attempts):
            try:
                # Wait for the search box to be present and interactable
                search_box = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="text"]'))
                )
                
                # Clear input completely
                search_box.clear()
                search_box.send_keys(name)
                time.sleep(0.5)
                
                # Wait for and locate the check gender button
                check_gender_button = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Check gender"]'))
                )
                
                # Click the check gender button
                check_gender_button.click()
                time.sleep(2)
                
                # Wait for the result container
                result_container = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '.mt-16.flex.items-center.flex-col.w-full'))
                )
                time.sleep(1)
                # Wait for the result to stabilize and not be empty
                WebDriverWait(self.driver, 10).until(
                    lambda driver: driver.find_elements(By.XPATH, ".//p[contains(@class, 'text-smi')]/b")
                )
                time.sleep(1)
                # Find gender elements
                gender_elements = result_container.find_elements(By.XPATH, ".//p[contains(@class, 'text-smi')]/b")
                
                # Check if gender element exists and has text
                if gender_elements and len(gender_elements) >= 2:
                    gender = gender_elements[1].text.strip()
                    
                    # Additional check to ensure gender is not empty or 'Unknown'
                    if gender and gender.lower() not in ['', 'unknown']:
                        return gender
                
                # If result is not satisfactory, wait and retry
                time.sleep(1)
            
            except Exception as e:
                print(f"Attempt {attempt + 1} failed for name {name}: {e}")
                
                # Wait between attempts to prevent overwhelming the site
                time.sleep(1)
        
        # If all attempts fail
        return "Error"

    def handle_interaction_prompt(self):
        """Handle user interaction prompt to search names manually"""
        prompt_text = self.prompt_entry.get().strip()
        if prompt_text:
            # Process prompt text as a name and display result
            result = self.get_gender_from_name(prompt_text)
            self.result_text.configure(state="normal")
            self.result_text.insert("end", f"Manual Prompt: {prompt_text} -> Gender: {result}\n")
            self.result_text.configure(state="disabled")
            self.prompt_entry.delete(0, "end")  # Clear the prompt entry
        else:
            messagebox.showwarning("Warning", "Prompt cannot be empty!")

    def enable_post_processing_features(self):
        """Enable interaction prompt and save buttons after processing"""
        self.prompt_entry.configure(state="normal")
        self.send_button.configure(state="normal")
        
        # Enable save buttons if results exist
        if self.processed_results:
            self.save_csv_button.configure(state="normal")
            self.save_excel_button.configure(state="normal")

    def start(self):
        """Run the tkinter window loop"""
        self.app.mainloop()

    def __del__(self):
        """Cleanup method to ensure browser is closed"""
        try:
            if hasattr(self, 'driver'):
                self.driver.quit()
        except Exception:
            pass

# Run the scraper
if __name__ == "__main__":
    genderize_scraper = GenderizeScraper()
    genderize_scraper.start()