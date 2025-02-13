import pandas as pd
import tkinter as tk
from tkinter import filedialog

def filter_multiple_schools():
    # List of school names to filter by
    school_names = [
        "ST.MADONNAS MATRIC , K.LAKSHMIPURAM",
        "CRESENT MATRICULATION",
        "PRASANNA MAT SCHOOL, PUTHIAMPUTHUR",
        "VIMAL MAT SCHOOL, KALUGUMALAI",
        "DEVAPITCHAI MEMORIAL MATRICULATION SCHOOL",
        "JAMES MAT.HSS, PRAKASAPURAM",
        "MAHARAJAPURAM SEENI MAT., NAGALAPURAM",
        "ST.JOHN DE. BRITTO ANGLO INDIAN MATRIC SCHOOL",
        "MUHYIDDEEN MATRIC.HSS, KAYALPATNAM",
        "HOLY CROSS HOME SCIENCE MATRICULATION, NEW COLONY",
        "LAKSHMI SRINIVASA VIDHYALAYA MAT SCHOOL",
        "MAGADMA MAT. SCHOOL, PUTHIAMPUTHUR",
        "A.P.C VEERABAHU MAT HR.SEC",
        "INFANT MATRIC HR. SEC. SCHOOL",
        "AUXILIUM MAT. SCHOOL, THERESPURAM",
        "CENTRAL MAT., KAYALPATNAM",
        "ST JAMES MATRICULATION, SRIVAI",
        "SALMA MATRIC HSS, UDANGUDI",
        "MARGOSCHIS MAT.SCH.NAZARETH",
        "PUNITHA OHM CONVENT MAT.S.KOVILPATTI",
        "K.V.S.MATRICULATION, TUTICORIN",
        "ST.PAUL MAT.H.SE.S.KOVILPATTI",
        "ANNAMMAL MAT., ARUMUGANERI",
        "X'AN MAT.SCHOOL,TUTICORIN",
        "KAMARAJ MAT.H.S.S.PANDAVARMANG",
        "PAUL MAT.S. KANTHASAMY P.",
        "SIVAKASI N. MAT. SCHOOL, M.YURANI",
        "CAMBRIDGE MAT. SCHOOL KONGARAYAKURICHI",
        "ICE - KING OF KINGS MATRIC. HR. SEC. SCHOOL, V.M.S. NAGAR",
        "GEETHA MAT, POLPETTAI",
        "KAMAK MAT. HR.SEC.S.",
        "ST. JOSEPH'S CONVENT MATRIC HSS, VEERAPANDIANPATNAM",
        "BMC. MATRIC HR.SEC.S.",
        "ST.ANDREWS MAT.S.SSNAGER,PANDA",
        "JOHN BOSCO  MAT. HSS, KOVILPATT",
        "KAMAKSHI VIDYALAYA MAT. HR.SS, THOOTHUKUDI",
        "ST.MARYS MATRICULATION SCHOOL, VEMBAR",
        "MM MATRIC HSS PATEMANAGARAM",
        "SOLOMON MAT.SCH. NAZARETH",
        "BELL MAT.SCHOOL",
        "SRI KB MAT.SCHOOL  KOMMADIKOTTAI",
        "D.M.NS DR.SIVANTHI ADITHAN MAT",
        "STAR MAT HSS, RENGANATHAPURAM",
        "MEERA MAT.SCHOOL, ARAMPANNAI",
        "APARNA MATRIC HSS, PARAMANKURICHI",
        "MOTHER THERESA MAT. , KAYATHAR",
        "SDA MAT.HI.SE.SCH.VAKKILST.KOV",
        "SENTHIL KUMARAN MAT. HR. SEC. SCHOOL, TIRUCHENDUR",
        "CHANDY MAT.SCHOOL",
        "GOMATHI H.P.S.MANTHITHOPPU",
        "KOVILPATTI NADAR KAMARAJ MATRIC HSS",
        "TVRK HINDU VIDYALAYA MAT. HSS",
        "ST. CHARLES MATRICULATION SCHOOL, VILATHIKULAM",
        "SRI VIVEKANANDA MAT SCHOOL",
        "ISHA VIDHYA MATRIC SCHOOL, KOOTAMPULI",
        "SACRED HEART.MAT.S",
        "C.K.T. MATRIC HR SEC SCHOOL KUMARAGIRI",
        "AUXILIUM MAT. SCHOOL KEELA ERAL",
        "MAHARISI  VIDYASRAM MAT. KOVILPATTI",
        "BHARATRATNA KAMARAJ MAT SCH",
        "ST.THOMAS THE APOSTLE MATRICULATION SCHOOL",
        "ANITHA KUMARAN MATRIC HIGHER SECONDARY SCHOOL. THANDUPATHU",
        "STARS' MODEL MATRIC. HR. SEC. SCHOOL, TIRUCHENDUR",
        "DR. MATHURAM TNDTA MDL.SCH.NAZARETH",
        "EVEREST MAT.S.JOTHI NAGAR KOVI",
        "SRI KANNA MAT.S.VOC NAGAR KOVI",
        "HENRIY MAT.HSS SATTANKULAM",
        "JOHNS MATIRCULATION, TUTICORIN",
        "SAKTHI VIDYALAYA MATRIC SCHOOL, KAMARAJ NAGAR",
        "TDTA PS., SAMATHANAPURAM",
        "TNDTA PS SAMATHANAPURAM",
        "BABA MAT.SCHOOL,KAYATHAR",
        "UBAGARA MATHA PS, KANDUKONDANM",
        "GEETHA MAT. HSS",
        "SPRING MATRICULATION SCHOOL, CHANDRAGIRI",
        "MARY IMMACULATE MATRIC SCHOOL",
        "L.K. MATRICULATION HSS, KAYALPATNAM",
        "ST.THOMAS MAT.HSS, INNACIARPUR"
    ]
    
    # Print step to terminal
    print("Loading the Excel file...")
    
    # Load the Excel file
    file_path = 'Book1.xlsx'  # Change to your file path
    df = pd.read_excel(file_path, sheet_name="Sheet1")
    
    # Print confirmation that the file has been loaded
    print(f"File loaded: {file_path}")
    
    # Print step to terminal
    print("Filtering rows based on school names...")
    
    # Filter rows where the school name in Column G (index 6) matches any of the school names in the list
    filtered_df = df[df.iloc[:, 6].isin(school_names)]
    
    # Print how many rows were filtered
    print(f"Filtered rows: {filtered_df.shape[0]}")
    
    # Create the Tkinter root window
    root = tk.Tk()
    root.withdraw()  # Hide the Tkinter root window
    
    # Ask user for the save location and file name using a save file dialog
    print("Please select a location to save the filtered file...")
    save_path = filedialog.asksaveasfilename(defaultextension=".xlsx", filetypes=[("Excel Files", "*.xlsx")], title="Save Filtered File As")
    
    # Check if the user provided a valid path (not canceled)
    if save_path:
        # Print step to terminal
        print(f"Saving the filtered file to: {save_path}")
        
        # Save the filtered dataframe to the chosen file
        filtered_df.to_excel(save_path, index=False)
        print(f"File saved successfully to: {save_path}")
    else:
        print("No file selected, operation canceled.")

# Run the function
filter_multiple_schools()
