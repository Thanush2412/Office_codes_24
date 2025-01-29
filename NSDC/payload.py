import requests
import json
import pandas as pd
import numpy as np

# API URL, Authorization Token, and CSRF Token
api_url = 'https://uatservices.ekaushal.com/api/user/v1/register/Candidate/v1'
auth_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFzdGhhMDJAeW9wbWFpbC5jb20iLCJleHAiOjE3MjY1NTgzOTYsImZpcnN0TmFtZSI6IiIsImhhc0ZpbGxlZFJlZ2lzdHJhdGlvbkluZm8iOmZhbHNlLCJpYXQiOjE3MjY1NTQ3OTYsImlzcyI6Ik5TRENfU2VydmVyIiwicm9sZSI6IlRyYWluaW5nIFBhcnRuZXIiLCJzdGF0dXMiOiJpbml0IiwidG9rZW4iOiJvVFN3MHVCIiwidXNlck5hbWUiOiJUUDIwMDk4OCJ9.QDcR6pd0Fn9B-tTaDsxl85SYKbJ2onbn8afL0sNr1I4'
csrf_token = '7InI8eFsxARaT0fK+oPzZsorXWFDc26aEb3aGfyqrqW5AsHFUOHR6sbZIYTgykXNRBgEKPbJCHn0tJfOIw+I6g==' 

# Start a session to maintain cookies (if needed)
session = requests.Session()

# Function to create a user by posting data
def create_user(user):
    try:
        payload = {
            'personalDetails': {
                'namePrefix': user.get('namePrefix', 'Mr'),
                'firstName': user['firstName'],
                'gender': user['gender'],
                'dob': user['dob'],
                'fatherName': user['fatherName'],
                'guardianName': user.get('guardianName', '')
            },
            'contactDetails': {
                'email': user['email'],
                'phone': user['phone'],
                'countryCode': user['countryCode']
            }
        }

        headers = {
            'Content-Type': 'application/json',
            'x-csrf-token': csrf_token,
            'Authorization': f'Bearer {auth_token}'
        }

        # Post the user data
        response = session.post(api_url, json=payload, headers=headers)
        response.raise_for_status()
        print(f"User {user['firstName']} created successfully: {response.json()}")
    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
        print(f"Response text: {http_err.response.text}")  # Print response text for debugging
    except Exception as err:
        print(f"Error creating user: {err}")

# Function to read user data from Excel and create users
def process_users_from_excel(file_path):
    try:
        # Read Excel file and replace NaN values with empty strings
        df = pd.read_excel(file_path).replace({np.nan: ''})

        # Loop through each row (each user)
        for index, row in df.iterrows():
            user_data = {
                'namePrefix': row.get('namePrefix', 'Mr'),
                'firstName': row.get('firstName', ''),
                'gender': row.get('gender', ''),
                'dob': row.get('dob', ''),
                'fatherName': row.get('fatherName', ''),
                'guardianName': row.get('guardianName', ''),
                'email': row.get('email', ''),
                'phone': row.get('phone', ''),
                'countryCode': row.get('countryCode', '')
            }

            # Create user for each row
            create_user(user_data)
    except Exception as e:
        print(f"Error processing Excel file: {e}")

# Main function
def main():
    # Path to your Excel file
    excel_file_path = 'users.xlsx'  # Change this to the path of your Excel file

    # Process users from Excel and create them
    process_users_from_excel(excel_file_path)

# Run the script
if __name__ == '__main__':
    main()
