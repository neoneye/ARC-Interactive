import json
import os
import sys
from glob import glob

# Directory containing JSON files
directory = '/Users/neoneye/git/arc-dataset-collection/dataset/ARC-AGI-2'

# Find files recursively and sort the filenames
filenames = sorted(glob(os.path.join(directory, '**/*.json'), recursive=True))

# Initialize the final dictionary
final_dict = {}

# Process each file
for index, filename in enumerate(filenames):
    # Extract the id from the filename (assuming it's the basename without extension)
    id = os.path.basename(filename).replace('.json', '')

    # Read and parse the JSON file
    try:
        with open(filename, 'r') as file:
            json_content = json.load(file)
    except Exception as error:
        print(f"Problem parsing json file at path: {filename}\nerror: {error}")
        sys.exit(-1)

    # Add the id to the JSON content
    json_content["id"] = id

    # Add this to the final dictionary
    final_dict[f"task-{index}"] = json_content

# Convert the final dictionary to JSON
final_json = json.dumps(final_dict, indent=2)

# Write the combined JSON to a file
with open('dataset.json', 'w') as file:
    file.write(final_json)

print("Combined JSON file created successfully.")

# Compress the dataset file using gzip
os.system("gzip -f dataset.json")

print("gz file created successfully.")
