# Uses Davide Bonin, 'Task Tagging' notebook
# https://www.kaggle.com/code/davidbnn92/task-tagging/notebook
# download the 'training_tasks_tagged.csv'

import pandas as pd

# Load the CSV file
df = pd.read_csv('training_tasks_tagged.csv')

# Delete columns
df = df.drop('Unnamed: 0', axis=1)
df = df.drop('task', axis=1)

# Remove the '.json' suffix from 'task_name' column
df['task_name'] = df['task_name'].str.replace('.json', '', regex=False)

# Save the modified DataFrame back to a new CSV file
df.to_csv('a.csv', index=False)
