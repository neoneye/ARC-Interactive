# Thanks to Andreas Köpf for adding the ice-dsl data to the arc-community/arc wiki.
# https://github.com/andreaskoepf
#
# This script extracts the ice-dsl values from the wiki and saves them to a JavaScript file
# https://github.com/arc-community/arc/wiki/Training-Riddles-0-to-3
# https://github.com/arc-community/arc/wiki/Evaluation-Riddles-0-to-3

import csv

# Function to parse a single Markdown file and return a dictionary of its data
def parse_markdown_file(filename):
    with open(filename, 'r') as file:
        lines = file.readlines()
    
    # Skip the header and the separator line, start from the actual data
    data_lines = lines[2:]
    
    # Dictionary to hold the parsed data
    file_dict = {}
    
    for line in data_lines:
        # Split the line into columns based on "|"
        columns = line.split('|')
        
        # Remove whitespace and newline characters
        columns = [col.strip() for col in columns]
        
        # Extract the Riddle ID and ice-dsl value, convert ice-dsl to int
        riddle_id = columns[1]
        ice_dsl_value = int(columns[4])
        
        # Add to dictionary
        file_dict[riddle_id] = ice_dsl_value
        
    return file_dict

# List of Markdown filenames
md_files = [
    'Training-Riddles-0-to-3.md',
    'Training Riddles 4 to 7.md',
    'Training Riddles 8 to b.md',
    'Training Riddles c to f.md',
    'Evaluation Riddles 0 to 3.md',
    'Evaluation Riddles 4 to 7.md',
    'Evaluation Riddles 8 to b.md',
    'Evaluation Riddles c to f.md',
]

# Initialize an empty dictionary
riddle_dict = {}

# Loop over the list of Markdown files and update riddle_dict with their contents
for md_file in md_files:
    riddle_dict.update(parse_markdown_file(md_file))

# Sort the dictionary by keys
sorted_riddle_dict = {k: riddle_dict[k] for k in sorted(riddle_dict)}

# Open output.csv in write mode
with open('output.csv', 'w', newline='') as csv_file:
    # Create a CSV writer object
    writer = csv.writer(csv_file)
    
    # Write the header row
    writer.writerow(['taskid', 'score'])
    
    # Iterate over the sorted dictionary and write each key-value pair as a row
    for key, value in sorted_riddle_dict.items():
        writer.writerow([key, value])

print("The dictionary has been successfully saved to output.csv.")
