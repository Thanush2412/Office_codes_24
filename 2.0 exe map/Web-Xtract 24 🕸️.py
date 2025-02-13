import time
import pandas as pd
import re
import os
import sys
import subprocess
from webdriver_manager.chrome import ChromeDriverManager
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium import webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from geopy.geocoders import Nominatim
from geopy.distance import geodesic
import customtkinter as ctk
from customtkinter import CTkFont
from tkinter import messagebox, scrolledtext
import threading  # For running tasks in separate threads
import pyttsx3  # For text-to-speech

class ScrollableResultsTable(ctk.CTkFrame):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        
        # Configure main frame weights
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        
        # Create headers frame
        self.headers_frame = ctk.CTkFrame(self)
        self.headers_frame.grid(row=0, column=0, sticky="ew", padx=5, pady=(5,0))
        
        # Configure column weights for headers
        weights = [0.1, 0.4, 0.4, 0.1]  # Column proportions
        for i, weight in enumerate(weights):
            self.headers_frame.grid_columnconfigure(i, weight=int(weight * 100))
        
        # Create headers
        headers = ["No.", "Name", "URL", "Status"]
        for i, (header, weight) in enumerate(zip(headers, weights)):
            header_label = ctk.CTkLabel(
                self.headers_frame,
                text=header,
                font=CTkFont(size=14, weight="bold"),
                fg_color="gray30",
                corner_radius=6
            )
            header_label.grid(row=0, column=i, sticky="ew", padx=2, pady=2)
        
        # Create scrollable frame for results
        self.results_scroll = ctk.CTkScrollableFrame(self, height=300)
        self.results_scroll.grid(row=1, column=0, sticky="nsew", padx=5, pady=5)
        
        # Configure column weights in scrollable frame
        for i, weight in enumerate(weights):
            self.results_scroll.grid_columnconfigure(i, weight=int(weight * 100))
        
        self.rows = []  # Store row widgets

    def add_row(self, index, name, url, status):
        """Add a new row to the results table"""
        row_num = len(self.rows)
        row = []
        
        # Create cells for each column
        data = [str(index), name, url, status]
        colors = {
            "Scraping": "yellow",
            "Success": "green",
            "Error": "red"
        }
        
        for i, content in enumerate(data):
            # Truncate long text
            if i in [1, 2]:  # Name and URL columns
                display_text = content[:50] + "..." if len(content) > 50 else content
            else:
                display_text = content
            
            # Set text color for status column
            text_color = colors.get(content, "white") if i == 3 else "white"
            
            cell = ctk.CTkLabel(
                self.results_scroll,
                text=display_text,
                font=CTkFont(size=12),
                text_color=text_color,
                fg_color="gray20" if row_num % 2 == 0 else "gray25",
                corner_radius=4
            )
            cell.grid(row=row_num, column=i, sticky="ew", padx=2, pady=1)
            row.append(cell)
        
        self.rows.append(row)

    def clear_rows(self):
        """Clear all rows from the table"""
        for row in self.rows:
            for cell in row:
                cell.destroy()
        self.rows = []

class GoogleMapsScraper:
    def __init__(self, root):
        self.root = root
        self.root.title("Web-Xtract 24 🕸️")
        self.root.geometry("900x700")
        self.root.wm_attributes("-topmost", 1)
        
        # Initialize text-to-speech engine
        self.tts_engine = pyttsx3.init()
        self.root.iconbitmap('spider-solid.ico')
        # Event to control speech stopping
        self.stop_speech_event = threading.Event()

        self.setup_ui()

    def setup_ui(self):
        # Location Input Frame
        input_frame = ctk.CTkFrame(self.root)
        input_frame.pack(padx=10, pady=10, fill='x')

        self.location_label = ctk.CTkLabel(input_frame, text="Enter Location:", font=("Arial", 14))
        self.location_label.pack(side='left', padx=10)

        self.location_entry = ctk.CTkEntry(
            input_frame,
            width=500,
            height=40,
            font=("Arial", 14),
            fg_color="black",
            text_color="white"
        )
        self.location_entry.pack(side='left', padx=10, expand=True, fill='x')

        # Info Button
        self.info_button = ctk.CTkButton(
            input_frame,
            text="ℹ️",
            width=40,
            height=40,
            font=("Arial", 18),
            command=self.show_info
        )
        self.info_button.pack(side='right', padx=5)

        # Create a frame for button and results area
        main_frame = ctk.CTkFrame(self.root)
        main_frame.pack(padx=10, pady=5, fill='both', expand=True)

        # Buttons Frame
        button_frame = ctk.CTkFrame(main_frame)
        button_frame.pack(padx=10, pady=5, fill='x')

        buttons = [
            ("Scrape Google Maps", self.on_scrape_button_click),
            ("Read and Extract Data", self.on_read_and_extract_button_click),
            ("Calculate Distances", self.on_calculate_distance_button_click),
            ("Clean and Save Text", self.on_clean_and_save_button_click)
        ]

        for text, command in buttons:
            btn = ctk.CTkButton(button_frame, text=text, font=("Arial", 14), command=command)
            btn.pack(side='left', padx=5)

        # Create results display frame
        self.results_frame = ctk.CTkFrame(main_frame)
        self.results_frame.pack(padx=10, pady=5, fill='both', expand=True)

        # Add headers for results
        headers_frame = ctk.CTkFrame(self.results_frame)
        headers_frame.pack(fill='x', padx=5, pady=5)

        headers = ["No.", "Name", "URL", "Status"]
        weights = [0.1, 0.4, 0.4, 0.1]  # Column proportions
        
        for header, weight in zip(headers, weights):
            header_label = ctk.CTkLabel(
                headers_frame,
                text=header,
                font=CTkFont(size=14, weight="bold"),
                fg_color="gray30",
                corner_radius=6
            )
            header_label.pack(side='left', fill='x', expand=True, padx=2, pady=2, anchor='center')

        # Create scrollable frame for results
        self.results_scroll = ctk.CTkScrollableFrame(self.results_frame, height=300)
        self.results_scroll.pack(fill='both', expand=True, padx=5, pady=5)

        # Create logging area
        self.text_widget = scrolledtext.ScrolledText(
            main_frame, 
            wrap=ctk.WORD, 
            height=10,  # Reduced height since we have results area
            font=("Comic Sans MS", 12),
            bg="black",
            fg="white"
        )
        self.text_widget.pack(padx=10, pady=5, fill='both', expand=True)

        # Configure tags for different message types
        self.text_widget.tag_configure("progress", foreground="cyan")
        self.text_widget.tag_configure("success", foreground="green")
        self.text_widget.tag_configure("error", foreground="red")
        self.text_widget.tag_configure("info", foreground="white")

    def add_result_row(self, index, name, url, status):
        """Add a new row to the results display"""
        row_frame = ctk.CTkFrame(self.results_scroll)
        row_frame.pack(fill='x', padx=2, pady=2)

        # Index column
        index_label = ctk.CTkLabel(
            row_frame,
            text=str(index),
            font=CTkFont(size=12),
            width=50
        )
        index_label.pack(side='left', padx=2)

        # Name column
        name_label = ctk.CTkLabel(
            row_frame,
            text=name[:50] + "..." if len(name) > 50 else name,
            font=CTkFont(size=12),
            anchor="w",
            width=200
        )
        name_label.pack(side='left', padx=2, fill='x', expand=True)

        # URL column
        url_label = ctk.CTkLabel(
            row_frame,
            text=url[:50] + "..." if len(url) > 50 else url,
            font=CTkFont(size=12),
            anchor="w",
            width=200
        )
        url_label.pack(side='left', padx=2, fill='x', expand=True)

        # Status column with color coding
        status_colors = {
            "Scraping": "yellow",
            "Success": "green",
            "Error": "red"
        }
        
        status_label = ctk.CTkLabel(
            row_frame,
            text=status,
            font=CTkFont(size=12),
            text_color=status_colors.get(status, "white"),
            width=70
        )
        status_label.pack(side='left', padx=2)

        # Update the UI immediately
        self.root.update_idletasks()

    def log_message(self, message, level="INFO"):
        """Log messages to both terminal and UI text area with colorized output"""
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        full_message = f"[{level}] {timestamp}: {message}"
        
        print(full_message)
        
        # Determine the tag based on the level
        tag = "info"  # default tag
        if level.lower() == "progress":
            tag = "progress"
        elif level.lower() == "success":
            tag = "success"
        elif level.lower() == "error":
            tag = "error"
        
        # Insert the message with the appropriate tag
        self.text_widget.insert(ctk.END, full_message + "\n", tag)
        self.text_widget.see(ctk.END)
        self.root.update_idletasks()

    def show_info(self):
        """Display a tooltip or narration explaining the process"""
        info_text = (
            "Steps to use this application:\n"
            "1. Enter a location in the text field.\n"
            "2. Click 'Scrape Google Maps' to fetch data.\n"
            "3. Use 'Read and Extract Data' to extract text from URLs.\n"
            "4. Calculate distances between locations with the distance calculator.\n"
            "5. Clean and save the extracted data for further analysis.\n"
        )

        # Display the information in a message box first, allowing user to click 'OK'
        messagebox.showinfo("How to Use", info_text)

        # After the message box is closed, start the narration in a separate thread
        narration_thread = threading.Thread(target=self._narrate_task, args=(info_text,), daemon=True)
        narration_thread.start()

        # Now narrate what each button will save as an Excel file
        filenames_text = (
            "The following Excel files will be saved:\n"
            "1. Google Maps results will be saved as 'google_maps_results.xlsx'.\n"
            "2. Final Google Maps results with extracted text will be saved as 'final_google_maps_results.xlsx'.\n"
            "3. Distance results will be saved as 'distance_results.xlsx'."
        )

        # Start narrating the filenames after the message box has been acknowledged
        threading.Thread(target=self._narrate_task, args=(filenames_text,), daemon=True).start()


    def _narrate_task(self, text):
        """Run text-to-speech narration in a separate thread"""
        try:
            for word in text.split('.'):
                if self.stop_speech_event.is_set():
                    break  # Stop the narration if the event is set
                self.tts_engine.say(word.strip())
                self.tts_engine.runAndWait()
        except Exception as e:
            self.log_message(f"Text-to-speech error: {e}", "ERROR")

    def stop_speech(self):
        """Stops any ongoing speech immediately."""
        self.stop_speech_event.set()


    def get_coordinates(self, location):
        """Get latitude and longitude for a location"""
        geolocator = Nominatim(user_agent="google_maps_scraper")
        try:
            self.log_message(f"Getting coordinates for {location}")
            loc = geolocator.geocode(location, timeout=30)
            if loc:
                coordinates = (loc.latitude, loc.longitude)
                self.log_message(f"Coordinates found: {coordinates}")
                return coordinates
            else:
                self.log_message(f"No coordinates found for {location}", "WARNING")
        except Exception as e:
            self.log_message(f"Error fetching coordinates: {e}", "ERROR")
        return None

    def calculate_distance(self, coord1, coord2):
        """Calculate distance between two coordinates"""
        try:
            distance = geodesic(coord1, coord2).kilometers
            self.log_message(f"Distance calculated: {distance} km")
            return distance
        except Exception as e:
            self.log_message(f"Distance calculation error: {e}", "ERROR")
            return float('inf')


    def scrape_google_maps(self, query, location):
        """Scrape Google Maps with real-time progress updates"""
        self.log_message(f"🚀 Starting Google Maps scraping for {query} near {location}")
        
        # Set up Chrome options
        try:
            self.log_message("⚙️ Initializing Edge settings...", "progress")
            edge_options = Options()
            edge_options.add_argument("--disable-gpu")
            edge_options.add_argument("--start-maximized")

            # Set Edge binary location (if different from the default)
            edge_options.binary_location = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"  # Update with actual path if needed

            # Specify the path to the msedgedriver executable
            edge_driver_path = "msedgedriver.exe"  # Update with the correct path to msedgedriver.exe

            # Create a Service object for Edge WebDriver
            service = Service(executable_path=edge_driver_path)

            # Initialize WebDriver with the specified service and options
            driver = webdriver.Edge(service=service, options=edge_options)

            self.log_message("✅ Edge WebDriver initialized successfully", "success")
            
            # Navigation progress
            self.log_message("🌐 Navigating to Google Maps...", "progress")
            driver.get("https://www.google.com/maps")
            self.log_message("✅ Successfully loaded Google Maps", "success")
            
            # Search process
            self.log_message("🔍 Locating search box...", "progress")
            search_box = driver.find_element(By.ID, "searchboxinput")
            search_box.clear()  # Clear any existing text
            
            # Type the search query with visual feedback
            self.log_message(f"⌨️ Entering search query: {query} near {location}", "progress")
            for char in f"{query} near {location}":
                search_box.send_keys(char)
                time.sleep(0.05)  # Slight delay for visual effect
            
            search_box.send_keys(Keys.RETURN)
            self.log_message("✅ Search query submitted", "success")
            
            # Loading progress
            self.log_message("⏳ Waiting for results to load...", "progress")
            start_time = time.time()
            loading_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
            loading_idx = 0
            
            # Show loading animation for 60 seconds
            while time.time() - start_time < 60:
                # Calculate remaining time (60 seconds - elapsed time)
                remaining_time = 60 - int(time.time() - start_time)

                # Log the remaining time in reverse
                self.log_message(f"{loading_chars[loading_idx]} Kindly scroll the map Area Loading results... {remaining_time}s remaining", "progress")
                
                # Update loading index
                loading_idx = (loading_idx + 1) % len(loading_chars)
                
                time.sleep(1)

                # Delete the last line of the text widget
                last_line_start = self.text_widget.index("end-2c linestart")
                last_line_end = self.text_widget.index("end-1c")
                self.text_widget.delete(last_line_start, last_line_end)

            # Wait for results with timeout
            try:
                self.log_message("🔍 Looking for result elements...", "progress")
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'm6QErb')]"))
                )
                self.log_message("✅ Results found successfully", "success")
            except Exception as e:
                self.log_message(f"⚠️ Timeout waiting for results: {str(e)}", "error")
                return []
            
            # Scraping results
            results = []
            self.log_message("📥 Starting to extract location data...", "progress")
            elements = driver.find_elements(By.XPATH, "//a[contains(@class, 'hfpxzc')]")
            
            total_elements = len(elements)
            self.log_message(f"📊 Found {total_elements} locations to process", "success")
            
            for i, element in enumerate(elements, 1):
                try:
                    name = element.get_attribute("aria-label")
                    url = element.get_attribute("href")
                    
                    if name and url:
                        results.append({"Name": name, "URL": url})
                        progress = (i / total_elements) * 100
                        self.log_message(f"✅ [{i}/{total_elements}] ({progress:.1f}%) Extracted: {name}", "success")
                    else:
                        self.log_message(f"⚠️ [{i}/{total_elements}] Skipped: Invalid data", "error")
                    
                    # Update progress bar (if you want to add one)
                    self.root.update_idletasks()
                    
                except Exception as e:
                    self.log_message(f"❌ Error extracting data for element {i}: {str(e)}", "error")
            
            self.log_message(f"🎉 Scraping completed! Extracted {len(results)} locations", "success")
            return results
        
        except Exception as e:
            self.log_message(f"❌ Critical error during scraping: {str(e)}", "error")
            return []
        
        finally:
            # Ensure driver quits even in case of an error
            try:
                driver.quit()
                self.log_message("👋 Browser session closed", "success")
            except:
                pass



    def extract_text_from_url(self, driver, url):
        """Extract text from a given URL with real-time progress updates"""
        try:
            self.log_message(f"🔗 Opening new tab for URL: {url}", "progress")
            driver.execute_script(f"window.open('{url}', '_blank');")
            driver.switch_to.window(driver.window_handles[1])
            
            # Show loading animation
            loading_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
            loading_idx = 0
            start_time = time.time()
            
            # Animate for 5 seconds or until page loads
            while time.time() - start_time < 5:
                self.log_message(f"{loading_chars[loading_idx]} Loading page content... {int(time.time() - start_time)}s", "progress")
                loading_idx = (loading_idx + 1) % len(loading_chars)
                time.sleep(0.2)
                # Delete the last line
                last_line_start = self.text_widget.index("end-2c linestart")
                last_line_end = self.text_widget.index("end-1c")
                self.text_widget.delete(last_line_start, last_line_end)

            extracted_text = ""
            try:
                self.log_message("🔍 Looking for content elements...", "progress")
                WebDriverWait(driver, 20).until(
                    EC.presence_of_element_located((By.XPATH, "//*[contains(@class, 'AeaXub')]"))
                )
                text_elements = driver.find_elements(By.XPATH, "//*[contains(@class, 'AeaXub')]")
                
                if text_elements:
                    self.log_message("✅ Content elements found", "success")
                    extracted_text = text_elements[0].text
                    self.log_message(f"📝 Extracted {len(extracted_text)} characters of text", "success")
                else:
                    self.log_message("⚠️ No content elements found", "error")
                    extracted_text = "No content found"
                    
            except Exception as e:
                self.log_message(f"❌ Error extracting text: {str(e)}", "error")
                extracted_text = f"Error: {str(e)}"

            self.log_message("🔄 Closing tab and switching back...", "progress")
            driver.close()
            driver.switch_to.window(driver.window_handles[0])
            self.log_message("✅ Successfully returned to main window", "success")

            return extracted_text
            
        except Exception as e:
            self.log_message(f"❌ Critical error processing URL: {str(e)}", "error")
            return None

    def clean_location_text(self, text):
        """Clean extracted text with progress updates"""
        try:
            self.log_message("🧹 Starting text cleaning...", "progress")
            
            # Remove non-ASCII characters
            self.log_message("🔍 Removing non-ASCII characters...", "progress")
            text = re.sub(r'[^\x00-\x7F]+', '', text)
            
            # Remove non-printable characters
            self.log_message("🔍 Removing non-printable characters...", "progress")
            text = ''.join([c for c in text if c.isprintable()])
            
            # Clean whitespace
            self.log_message("🔍 Cleaning whitespace...", "progress")
            text = re.sub(r'\s+', ' ', text).strip()
            
            self.log_message(f"✅ Text cleaned successfully. Final length: {len(text)} characters", "success")
            return text
            
        except Exception as e:
            self.log_message(f"❌ Text cleaning error: {str(e)}", "error")
            return text

    def get_direction_and_distance(self, from_location, to_location):
        """Calculate the distance between two locations using Microsoft Edge WebDriver"""
        
        # Construct the URL for Google Maps Directions
        url = f"https://www.google.com/maps/dir/{from_location.replace(' ', '+')}/{to_location.replace(' ', '+')}"

        # Initialize Edge options
        edge_options = Options()


        # Path to the Edge WebDriver executable (Ensure this points to the correct path of msedgedriver)
        edge_driver_path = "msedgedriver.exe"  # Update with correct path if needed

        # Initialize the Edge WebDriver with the Service and Options objects
        service = Service(executable_path=edge_driver_path)
        driver = webdriver.Edge(service=service, options=edge_options)

        try:
            # Open the URL in Edge browser
            driver.get(url)
            time.sleep(5)  # Wait for the page to load
            
            try:
                # Locate the element containing the distance value
                distance_element = driver.find_element(By.CLASS_NAME, 'ivN21e.tUEI8e')
                distance = distance_element.text.strip()  # Extract the distance text
                self.log_message(f"Distance from {from_location} to {to_location}: {distance}")
                return distance
            except Exception as e:
                # If the distance element can't be found, log the error
                self.log_message(f"Error extracting distance for {from_location} to {to_location}: {e}", "ERROR")
                return None
        except Exception as e:
            # If there's an error fetching the URL or page load issues
            self.log_message(f"Error fetching directions for {from_location} to {to_location}: {e}", "ERROR")
            return None
        finally:
            # Ensure the browser quits after completion
            driver.quit()

    def on_scrape_button_click(self):
        """Handle scrape button click in a separate thread"""
        query = "matriculation higher secondary schools"
        location = self.location_entry.get().strip()
        
        if not location:
            messagebox.showerror("Error", "Please enter a location.")
            return
        
        def run_scrape():
            try:
                data = self.scrape_google_maps(query, location)
                if data:
                    pd.DataFrame(data).to_excel("google_maps_results.xlsx", index=False)
                    self.log_message("Data saved to 'google_maps_results.xlsx'")
                    messagebox.showinfo("Success", "Data has been saved successfully!")
                else:
                    messagebox.showerror("Error", "No data scraped.")
            except Exception as e:
                self.log_message(f"Scraping process failed: {e}", "ERROR")
                messagebox.showerror("Error", str(e))

        threading.Thread(target=run_scrape, daemon=True).start()

    def on_read_and_extract_button_click(self):
        """Handle read and extract button click in a separate thread with real-time updates"""
        def run_extract():
            try:
                self.log_message("📂 Reading existing results file...", "progress")
                df = pd.read_excel("google_maps_results.xlsx")
                self.log_message(f"✅ Found {len(df)} entries to process", "success")
                
                self.log_message("🌐 Initializing Chrome...", "progress")
                edge_options = Options()
                edge_options.add_argument("--disable-gpu")
                edge_options.add_argument("--start-maximized")

                # Set Edge binary location (if different from the default)
                edge_options.binary_location = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"  # Update with actual path if needed

                # Specify the path to the msedgedriver executable
                edge_driver_path = "msedgedriver.exe"  # Update with the correct path to msedgedriver.exe

                # Create a Service object for Edge WebDriver
                service = Service(executable_path=edge_driver_path)

                # Initialize WebDriver with the specified service and options
                driver = webdriver.Edge(service=service, options=edge_options)
                self.log_message("✅ Browser initialized successfully", "success")
                
                results_with_text = []
                total_urls = len(df)
                
                for index, row in df.iterrows():
                    url = row['URL']
                    progress = ((index + 1) / total_urls) * 100
                    
                    self.log_message(f"🔄 Processing {index + 1}/{total_urls} ({progress:.1f}%)", "progress")
                    self.log_message(f"🔗 URL: {url}", "info")
                    
                    text = self.extract_text_from_url(driver, url)
                    cleaned_text = self.clean_location_text(text)
                    
                    results_with_text.append({
                        "Name": row["Name"],
                        "URL": url,
                        "Extracted Text": cleaned_text
                    })
                    
                    self.log_message(f"✅ Processed: {row['Name']}", "success")
                    self.log_message(f"📊 Progress: {index + 1}/{total_urls} ({progress:.1f}%)", "info")
                
                driver.quit()
                self.log_message("👋 Browser session closed", "success")
                
                self.log_message("💾 Saving extracted data...", "progress")
                pd.DataFrame(results_with_text).to_excel("final_google_maps_results.xlsx", index=False)
                self.log_message("🎉 Data saved successfully to 'final_google_maps_results.xlsx'", "success")
                
                messagebox.showinfo("Success", "Text extraction completed!")
            
            except Exception as e:
                self.log_message(f"❌ Process failed: {str(e)}", "error")
                messagebox.showerror("Error", str(e))

        threading.Thread(target=run_extract, daemon=True).start()

    def on_calculate_distance_button_click(self):
        """Show file selection dialog and calculate distances between locations"""
        def ask_file_source():
            answer = messagebox.askyesno(
                "File Selection",
                "Would you like to use the existing final_google_maps_results.xlsx file?\n\n" +
                "Click 'Yes' to use existing file\n" +
                "Click 'No' to specify a new file"
            )
            return answer

        def run_calculate_distance():
            try:
                # Ask user for file source
                use_existing = ask_file_source()
                
                if use_existing:
                    try:
                        df = pd.read_excel("final_google_maps_results.xlsx")
                        location_column = 'Extracted Text'  # Default column for existing file
                    except FileNotFoundError:
                        messagebox.showerror("Error", "final_google_maps_results.xlsx not found!")
                        return
                else:
                    # Let user select a file
                    from tkinter import filedialog
                    file_path = filedialog.askopenfilename(
                        title="Select Excel File",
                        filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
                    )
                    if not file_path:
                        self.log_message("File selection cancelled")
                        return
                    
                    df = pd.read_excel(file_path)
                    
                    # Show available columns for selection
                    columns = df.columns.tolist()
                    column_window = ctk.CTkToplevel()
                    column_window.title("Select Location Column")
                    column_window.geometry("300x200")
                    
                    selected_column = ctk.StringVar()
                    
                    def on_column_select():
                        selected_column.set(column_listbox.get())
                        column_window.destroy()
                    
                    label = ctk.CTkLabel(column_window, text="Select the column containing location data:")
                    label.pack(pady=10)
                    
                    column_listbox = ctk.CTkComboBox(
                        column_window,
                        values=columns,
                        command=lambda x: selected_column.set(x)
                    )
                    column_listbox.pack(pady=10)
                    column_listbox.set(columns[0])
                    
                    confirm_button = ctk.CTkButton(
                        column_window,
                        text="Confirm",
                        command=on_column_select
                    )
                    confirm_button.pack(pady=10)
                    
                    column_window.wait_window()
                    location_column = selected_column.get()
                    
                    if not location_column:
                        self.log_message("Column selection cancelled")
                        return

                to_location = self.location_entry.get().strip()
                if not to_location:
                    messagebox.showerror("Error", "Please enter a destination location.")
                    return
                
                distance_results = []
                for index, row in df.iterrows():
                    from_location = row[location_column]
                    distance = self.get_direction_and_distance(from_location, to_location)
                    
                    if distance:
                        distance_results.append({
                            "From": from_location,
                            "To": to_location,
                            "Distance": distance
                        })
                
                # Save results
                output_file = "distance_results.xlsx"
                pd.DataFrame(distance_results).to_excel(output_file, index=False)
                self.log_message(f"Distance calculations saved to '{output_file}'")
                messagebox.showinfo("Success", "Distances calculated successfully!")
            
            except Exception as e:
                self.log_message(f"Distance calculation failed: {e}", "ERROR")
                messagebox.showerror("Error", str(e))

        threading.Thread(target=run_calculate_distance, daemon=True).start()


    def on_clean_and_save_button_click(self):
        """Handle clean and save button click in a separate thread"""
        def run_clean_and_save():
            try:
                df = pd.read_excel("final_google_maps_results.xlsx")
                
                cleaned_results = []
                
                for index, row in df.iterrows():
                    cleaned_text = self.clean_location_text(row['Extracted Text'])
                    
                    cleaned_results.append({
                        "Name": row['Name'],
                        "URL": row['URL'],
                        "Cleaned Extracted Text": cleaned_text
                    })
                
                pd.DataFrame(cleaned_results).to_excel("cleaned_google_maps_results.xlsx", index=False)
                self.log_message("Cleaned data saved to 'cleaned_google_maps_results.xlsx'")
                messagebox.showinfo("Success", "Data cleaned and saved successfully!")
            
            except Exception as e:
                self.log_message(f"Cleaning process failed: {e}", "ERROR")
                messagebox.showerror("Error", str(e))

        threading.Thread(target=run_clean_and_save, daemon=True).start()


if __name__ == "__main__":
    root = ctk.CTk()
    app = GoogleMapsScraper(root)
    root.mainloop()
