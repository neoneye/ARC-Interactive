import csv
import json

# Define the path for the input CSV file and the output JSON file
input_csv_file_path = 'output.csv'
output_json_file_path = 'output2.json'

# Initialize dictionaries to hold the solved and unsolved tasks
solved_tasks = []
unsolved_tasks = []

# Open the CSV file for reading
with open(input_csv_file_path, 'r') as csvfile:
    # Use csv.DictReader to read the CSV into a dictionary format
    reader = csv.DictReader(csvfile)
    
    # Iterate over each row in the CSV
    for row in reader:
        # Check the score to determine if the task is solved or unsolved
        if row['score'] == '-1':
            unsolved_tasks.append(row['taskid'])
        else:
            solved_tasks.append(row['taskid'])

# Prepare the final structure for the JSON output
output_data = {
    "icecuber_solved": solved_tasks,
    "icecuber_unsolved": unsolved_tasks
}

# Write the output_data dictionary to a JSON file
with open(output_json_file_path, 'w') as jsonfile:
    json.dump(output_data, jsonfile, indent=2)

print("The JSON file has been created with the specified format.")
