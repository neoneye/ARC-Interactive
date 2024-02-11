import pandas as pd

# Load the CSV file
df = pd.read_csv('input.csv')

# Keep only these columns
df = df[['path_data', 'correct']]

# Remove the '.json' suffix from 'path_data' column
df['path_data'] = df['path_data'].str.replace('.json', '', regex=False)

# Save the modified DataFrame back to a new CSV file
df.to_csv('a.csv', index=False)
