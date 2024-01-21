require 'json'

# Directory containing JSON files
directory = '/Users/neoneye/git/arc-dataset-collection/dataset/ARC'

# Find files recursively and sort the filenames
filenames = Dir.glob("#{directory}/**/*.json").sort

# Initialize the final hash
final_hash = {}

# Process each file
filenames.each_with_index do |filename, index|
  # Extract the id from the filename (assuming it's the basename without extension)
  id = File.basename(filename, ".json")

  # Read and parse the JSON file
  file_content = File.read(filename)
  json_content = JSON.parse(file_content)

  # Add the id to the JSON content
  json_content["id"] = id

  # Add this to the final hash
  final_hash["task-#{index}"] = json_content
end

# Convert the final hash to JSON
final_json = JSON.pretty_generate(final_hash)

# Write the combined JSON to a file
File.write('dataset.json', final_json)

puts "Combined JSON file created successfully."

system("gzip dataset.json")

puts "gz file created successfully."
