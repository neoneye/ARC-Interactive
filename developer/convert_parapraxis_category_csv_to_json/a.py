import pandas as pd

# Load the CSV file
df = pd.read_csv('input.csv')

# Keep only these columns
df = df[['file_name', 'category']]

# Extract just the name from the absolute
df['file_name'] = df['file_name'].str.extract(r'([^\\]+)\.json$', expand=False)

# Save the modified DataFrame back to a new CSV file
df.to_csv('a.csv', index=False)
