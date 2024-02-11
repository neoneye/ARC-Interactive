import csv
import json

# Initialize an empty dictionary to hold the reverse mapping
category_mapping = {}

# Open the CSV file for reading
with open('a.csv', 'r') as csvfile:
    # Use csv.DictReader to read the CSV into a dictionary format
    reader = csv.DictReader(csvfile)
    
    # Iterate over each row in the CSV
    for row in reader:
        # Extract file_name and category
        file_name = row['file_name']
        category = row['category']
        
        # Check if the category is already a key in our dictionary
        if category not in category_mapping:
            category_mapping[category] = []
        
        # Append the file_name to the category's list
        category_mapping[category].append(file_name)

# Sort by filename
for category in category_mapping:
    category_mapping[category].sort()

# Sort the dictionary by category keys as integers
sorted_category_mapping = {category: category_mapping[category] for category in sorted(category_mapping, key=int)}


# Write the sorted_category_mapping dictionary to a JSON file
with open('b.json', 'w') as jsonfile:
    json.dump(sorted_category_mapping, jsonfile, indent=2)

print("Fully sorted JSON file has been created, named: b.json")
