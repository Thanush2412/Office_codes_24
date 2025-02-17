import customtkinter as ctk
import tkinter as tk
from tkinter import ttk, filedialog
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
import time
from datetime import datetime
import json
import os
from plyer import notification
import threading

class HackerRankScraper:
    def __init__(self):
        # Set up the main window
        self.root = ctk.CTk()
        self.root.title("HackerRank Leaderboard Scraper")
        self.root.geometry("800x600")
        
        # Set dark mode for the entire application
        ctk.set_appearance_mode("dark")
        
        # Configure grid layout
        self.root.grid_columnconfigure(0, weight=1)
        self.root.grid_rowconfigure(2, weight=1)  # Removed notification area
        
        # Initialize variables
        self.driver = None
        self.is_scraping = False
        self.is_paused = False
        self.data = []
        self.current_page = 1
        self.last_successful_page = 0
        self.root.iconbitmap('icon.ico') 
        # Create frames
        self.create_input_frame()
        self.create_control_frame()
        self.create_table_frame()
        
        # Bind close event
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Load last session if exists
        self.load_session()
    
    def create_input_frame(self):
        input_frame = ctk.CTkFrame(self.root, bg_color="#1e1e1e")  # Dark background for frame
        input_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        
        # URL input
        url_label = ctk.CTkLabel(input_frame, text="Base URL:", text_color="white")  # White text for labels
        url_label.grid(row=0, column=0, padx=5, pady=5)
        self.url_entry = ctk.CTkEntry(input_frame, width=400, fg_color="#333333", text_color="white")  # Dark input fields with white text
        self.url_entry.grid(row=0, column=1, columnspan=3, padx=5, pady=5)
        self.url_entry.insert(0, "https://www.hackerrank.com/contests/dsa-trainers/leaderboard/")
        
        # Page range inputs
        start_label = ctk.CTkLabel(input_frame, text="Start Page:", text_color="white")
        start_label.grid(row=1, column=0, padx=5, pady=5)
        self.start_page = ctk.CTkEntry(input_frame, width=100, fg_color="#333333", text_color="white")
        self.start_page.grid(row=1, column=1, padx=5, pady=5)
        self.start_page.insert(0, "1")
        
        end_label = ctk.CTkLabel(input_frame, text="End Page:", text_color="white")
        end_label.grid(row=1, column=2, padx=5, pady=5)
        self.end_page = ctk.CTkEntry(input_frame, width=100, fg_color="#333333", text_color="white")
        self.end_page.grid(row=1, column=3, padx=5, pady=5)
        self.end_page.insert(0, "5")
        
        # Sleep time input
        sleep_label = ctk.CTkLabel(input_frame, text="Page Load Time (seconds):", text_color="white")
        sleep_label.grid(row=2, column=0, padx=5, pady=5)
        self.sleep_time = ctk.CTkEntry(input_frame, width=100, fg_color="#333333", text_color="white")
        self.sleep_time.grid(row=2, column=1, padx=5, pady=5)
        self.sleep_time.insert(0, "3")
    
    def create_control_frame(self):
        control_frame = ctk.CTkFrame(self.root, bg_color="#1e1e1e")  # Dark background for frame
        control_frame.grid(row=1, column=0, padx=10, pady=5, sticky="ew")
        
        # Buttons
        self.start_button = ctk.CTkButton(
            control_frame, 
            text="Start Scraping", 
            command=self.start_scraping,
            fg_color="green",
            text_color="white"  # White text
        )
        self.start_button.grid(row=0, column=0, padx=5, pady=5)
        
        self.pause_button = ctk.CTkButton(
            control_frame, 
            text="Pause", 
            command=self.pause_resume_scraping,
            fg_color="orange",
            text_color="white",  # White text
            state="disabled"
        )
        self.pause_button.grid(row=0, column=1, padx=5, pady=5)
        
        self.stop_button = ctk.CTkButton(
            control_frame, 
            text="Stop", 
            command=self.stop_scraping,
            fg_color="red",
            text_color="white"  # White text
        )
        self.stop_button.grid(row=0, column=2, padx=5, pady=5)
        
        self.export_button = ctk.CTkButton(
            control_frame, 
            text="Export to Excel", 
            command=self.export_to_excel,
            text_color="white"  # White text
        )
        self.export_button.grid(row=0, column=3, padx=5, pady=5)
        
        # Progress bar
        self.progress_bar = ctk.CTkProgressBar(control_frame, fg_color="#333333")  # Dark progress bar background
        self.progress_bar.grid(row=1, column=0, columnspan=4, padx=10, pady=5, sticky="ew")
        self.progress_bar.set(0)
    
    def create_table_frame(self):
        table_frame = ctk.CTkFrame(self.root, bg_color="#1e1e1e")  # Dark background for frame
        table_frame.grid(row=2, column=0, padx=10, pady=5, sticky="nsew")
        
        # Create and configure dark theme style for Treeview
        style = ttk.Style()
        style.configure("Treeview",
                       background="#1e1e1e",  # Dark background for treeview
                       foreground="white",     # White text in treeview
                       fieldbackground="#1e1e1e")
        style.configure("Treeview.Heading",
                       background="#333333",  # Dark header background
                       foreground="Black")    # White text in header
        
        # Create Treeview with scrollbar
        self.tree = ttk.Treeview(
            table_frame, 
            columns=("Rank", "Hacker Name", "Score"), 
            show="headings",
            style="Treeview"
        )
        
        # Configure columns
        self.tree.heading("Rank", text="Rank")
        self.tree.heading("Hacker Name", text="Hacker Name")
        self.tree.heading("Score", text="Score")
        
        self.tree.column("Rank", width=100)
        self.tree.column("Hacker Name", width=300)
        self.tree.column("Score", width=100)
        
        # Add scrollbars
        y_scrollbar = ttk.Scrollbar(table_frame, orient="vertical", command=self.tree.yview)
        x_scrollbar = ttk.Scrollbar(table_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=y_scrollbar.set, xscrollcommand=x_scrollbar.set)
        
        # Grid layout
        self.tree.grid(row=0, column=0, sticky="nsew")
        y_scrollbar.grid(row=0, column=1, sticky="ns")
        x_scrollbar.grid(row=1, column=0, sticky="ew")
        
        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_rowconfigure(0, weight=1)
    
    def show_notification(self, message, title="HackerRank Scraper", type="info"):
        # Map our notification types to appropriate icons
        icons = {
            "error": "error",
            "warning": "warning", 
            "info": "info",
            "success": "info"  # Plyer doesn't have a success icon, use info instead
        }
        
        # For errors and warnings, use longer timeout
        timeout = 10 if type in ["error", "warning"] else 5
        
        # Show desktop notification in a separate thread to avoid blocking the UI
        def show_desktop_notification():
            try:
                notification.notify(
                    title=title,
                    message=message,
                    app_name="HackerRank Scraper",
                    timeout=timeout,
                    app_icon=None  # You can add an icon file path here
                )
            except Exception as e:
                print(f"Failed to show notification: {e}")
        
        # Start notification in a separate thread
        threading.Thread(target=show_desktop_notification).start()
    
    def load_session(self):
        try:
            if os.path.exists("scraper_session.json"):
                with open("scraper_session.json", "r") as f:
                    session_data = json.load(f)
                    self.data = session_data.get("data", [])
                    self.last_successful_page = session_data.get("last_page", 0)
                    
                    # Populate table with saved data
                    for item in self.data:
                        self.tree.insert("", "end", values=item)
                    
                    # Update start page to continue from last successful page
                    self.start_page.delete(0, tk.END)
                    self.start_page.insert(0, str(self.last_successful_page + 1))
                    
                self.show_notification(f"Loaded session with {len(self.data)} records", title="Session Loaded")
        except Exception as e:
            self.show_notification(f"Error loading session: {e}", type="error")
    
    def save_session(self):
        try:
            session_data = {
                "data": self.data,
                "last_page": self.last_successful_page
            }
            with open("scraper_session.json", "w") as f:
                json.dump(session_data, f)
            self.show_notification("Session saved", title="Session Saved", type="success")
        except Exception as e:
            self.show_notification(f"Error saving session: {e}", type="error")
    
    def pause_resume_scraping(self):
        if self.is_paused:
            self.is_paused = False
            self.pause_button.configure(text="Pause", fg_color="orange")
            self.show_notification("Scraping resumed", title="Scraping Status")
        else:
            self.is_paused = True
            self.pause_button.configure(text="Resume", fg_color="green")
            self.show_notification("Scraping paused", title="Scraping Status")
    
    def start_scraping(self):
        if self.is_scraping:
            return
        
        # Get user inputs
        try:
            start_page = int(self.start_page.get())
            end_page = int(self.end_page.get())
            sleep_time = float(self.sleep_time.get())
            base_url = self.url_entry.get().rstrip('/')
            
            if start_page > end_page:
                self.show_notification("Start page must be less than or equal to end page", type="error")
                return
        except ValueError:
            self.show_notification("Please enter valid numbers", type="error")
            return
        
        # Setup driver if not already running
        if not self.driver and not self.setup_driver():
            return
        
        self.is_scraping = True
        self.is_paused = False
        self.start_button.configure(state="disabled")
        self.pause_button.configure(state="normal")
        self.show_notification("Scraping started", title="Scraping Status")
        
        # Start scraping in a separate thread
        self.scraping_thread = threading.Thread(
            target=self.scraping_worker,
            args=(base_url, start_page, end_page, sleep_time)
        )
        self.scraping_thread.start()
    
    def scraping_worker(self, base_url, start_page, end_page, sleep_time):
        total_pages = end_page - start_page + 1
        
        for page_num in range(start_page, end_page + 1):
            while self.is_paused:
                time.sleep(0.5)
                if not self.is_scraping:
                    break
                    
            if not self.is_scraping:
                break
                
            current_url = f"{base_url}/{page_num}"
            self.show_notification(f"Scraping page {page_num} of {end_page}", title="Scraping Progress")
            success = self.scrape_page(current_url, sleep_time)
            
            if success:
                self.last_successful_page = page_num
                self.save_session()
            else:
                break
                
            # Update progress bar
            progress = (page_num - start_page + 1) / total_pages
            self.progress_bar.set(progress)
        
        self.cleanup()
    
    def cleanup(self):
        if self.driver:
            self.driver.quit()
            self.driver = None
        
        self.is_scraping = False
        self.start_button.configure(state="normal")
        self.pause_button.configure(state="disabled")
        
        # Auto-export on completion
        self.export_to_excel(auto_save=True)
        self.show_notification("Scraping completed!", title="Scraping Complete", type="success")
    
    def stop_scraping(self):
        if self.is_scraping:
            self.is_scraping = False
            self.save_session()
            self.export_to_excel(auto_save=True)
            self.show_notification("Scraping stopped", title="Scraping Stopped", type="warning")
    
    def on_closing(self):
        if self.is_scraping:
            self.stop_scraping()
        self.save_session()
        self.root.destroy()
    
    def setup_driver(self):
        try:
            self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
            return True
        except Exception as e:
            self.show_notification(f"Failed to setup Chrome driver: {str(e)}", type="error")
            return False
    
    def scrape_page(self, url, sleep_time):
        try:
            self.driver.get(url)
            time.sleep(sleep_time)  # Configurable sleep time
            
            rows = self.driver.find_elements(By.CLASS_NAME, "leaderboard-row")
            
            for row in rows:
                try:
                    rank = len(self.data) + 1
                    hacker_name = row.find_element(By.CLASS_NAME, "cursor.leaderboard-hackername.rg_5").text
                    score = row.find_element(By.CLASS_NAME, "span-flex-3").text.strip()
                    
                    self.data.append((rank, hacker_name, score))
                    self.tree.insert("", "end", values=(rank, hacker_name, score))
                    
                    self.root.update_idletasks()
                except Exception as e:
                    self.show_notification(f"Error extracting row data: {e}", type="warning")
            
            return True
        except Exception as e:
            self.show_notification(f"Failed to scrape page: {str(e)}", type="error")
            return False
    
    def export_to_excel(self, auto_save=False):
        if not self.data:
            if not auto_save:
                self.show_notification("No data to export", type="warning")
            return
            
        try:
            df = pd.DataFrame(self.data, columns=["Rank", "Hacker Name", "Score"])
            
            if auto_save:
                # Using last hacker name for auto-save
                last_hacker = self.data[-1][1] if self.data else "unknown"
                filename = f"autosaveupto_{last_hacker}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
                df.to_excel(filename, index=False)
                self.show_notification(f"Auto-saved to {filename}", title="Auto-Save Complete", type="success")
            else:
                # Ask for save location
                default_name = f"hackerrank_leaderboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
                filename = filedialog.asksaveasfilename(
                    defaultextension=".xlsx",
                    filetypes=[("Excel Files", "*.xlsx"), ("All Files", "*.*")],
                    initialfile=default_name
                )
                
                if filename:  # User didn't cancel the dialog
                    df.to_excel(filename, index=False)
                    self.show_notification(f"Data exported to {filename}", title="Export Complete", type="success")
                else:
                    self.show_notification("Export cancelled", title="Export Cancelled")
                    
        except Exception as e:
            if not auto_save:
                self.show_notification(f"Failed to export data: {str(e)}", type="error")
    
    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = HackerRankScraper()
    app.run()