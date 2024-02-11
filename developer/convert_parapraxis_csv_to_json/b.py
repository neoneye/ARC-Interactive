import csv
import json

# Initialize an empty dictionary to hold the task mapping
task_mapping = {}

# Open the CSV file for reading
with open('a.csv', 'r') as csvfile:
    # Use csv.DictReader to read the CSV into a dictionary format
    reader = csv.DictReader(csvfile)
    
    # Iterate over each row in the CSV
    for row in reader:
        # Iterate over each field (column) in the row
        for task, value in row.items():
            # Skip the task_name column
            if task == 'path_data':
                continue
            
            # Check if the task has a value of 1 (meaning the task is associated with the task_name)
            if value == 'True':
                # If the task isn't already a key in our dictionary, add it with an empty list
                if task not in task_mapping:
                    task_mapping[task] = []
                # Append the task_name (row's identifier) to the task's list
                task_mapping[task].append(row['path_data'])

# Sort the task_name array for each task
for task in task_mapping:
    task_mapping[task].sort()

# Create a new dictionary with sorted keys
sorted_task_mapping = {task: task_mapping[task] for task in sorted(task_mapping)}

# Write the sorted_task_mapping dictionary to a JSON file
with open('b.json', 'w') as jsonfile:
    json.dump(sorted_task_mapping, jsonfile, indent=2)

print("Fully sorted JSON file has been created. named: b.json")
