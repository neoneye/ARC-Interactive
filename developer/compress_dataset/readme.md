# Adding a new dataset to ARC-Interactive

You have a bunch of ARC like json files in a single dir, that you want to see visualized.

### Step 1 - edit run.rb

Open `run.rb` in an editor.

Insert your dirpath.
```
directory = '/Users/neoneye/git/arc-dataset-collection/dataset/ARC'
```

### Step 2 - run script

Run the `ruby run.rb`.

That should give you a file with the named `dataset.json.gz`. 
You can rename it to `JoanOfARC.json.gz`.

### Step 3 - move file

Move the `JoanOfARC.json.gz` into this dir
https://github.com/neoneye/ARC-Interactive/tree/main/webroot/dataset

### Step 4 - edit index.html

Open `index.html` in an editor.

Modify the dataset picker, so it includes `JoanOfARC.json.gz` here:
https://github.com/neoneye/ARC-Interactive/blob/main/webroot/index.html#L75

### Step 5 - reload browser

Reload index.html in the browser, and there should now be a `JoanOfARC` in the dataset picker.
