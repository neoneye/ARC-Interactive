class PageController {
    constructor() {
        this.sb = null;
        // Entries of {row, checkbox} for the rows currently shown in the table.
        this.entries = [];
        // True while a Download or Delete is running, so a double-click can't start it twice.
        this.busy = false;

        // Assign link to "Back button", so it preserves the URL parameters.
        document.getElementById('link-to-tasks-page').href = '.' + window.location.search;
    }

    async onload() {
        Theme.assignBodyClassName();
        try {
            this.sb = await loadSupabaseClient();
            const { data, error } = await this.sb.auth.getSession();
            if (error) {
                throw error;
            }
            if (data.session) {
                await this.showSignedIn();
            } else {
                this.showSignedOut();
            }
        } catch (error) {
            console.error('review onload failed', error);
            this.showSignedOut();
            this.setStatus('Error: ' + (error?.message ?? error));
        }
    }

    setBusy(isBusy) {
        this.busy = isBusy;
        document.getElementById('download-button').disabled = isBusy;
        document.getElementById('delete-button').disabled = isBusy;
    }

    setStatus(text) {
        document.getElementById('status-line').textContent = text;
    }

    showSignedOut() {
        document.getElementById('sign-in-panel').classList.remove('hidden');
        document.getElementById('sign-out-button').classList.add('hidden');
        document.getElementById('review-table').classList.add('hidden');
        this.clearTable();
    }

    async showSignedIn() {
        document.getElementById('sign-in-panel').classList.add('hidden');
        document.getElementById('sign-out-button').classList.remove('hidden');
        await this.loadRows();
    }

    async sendMagicLink() {
        const email = document.getElementById('sign-in-email').value.trim();
        if (email == '') {
            alert('Please enter your email.');
            return;
        }
        try {
            const { error } = await this.sb.auth.signInWithOtp({
                email: email,
                options: {
                    shouldCreateUser: false,
                    emailRedirectTo: window.location.origin + window.location.pathname,
                },
            });
            if (error) {
                throw error;
            }
            this.setStatus('Check your email');
        } catch (error) {
            console.error('sendMagicLink failed', error);
            this.setStatus('Error: ' + (error?.message ?? error));
        }
    }

    async signOut() {
        try {
            const { error } = await this.sb.auth.signOut();
            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('signOut failed', error);
            alert('Sign out failed: ' + (error?.message ?? error));
            return;
        }
        this.setStatus('');
        this.showSignedOut();
    }

    clearTable() {
        this.entries = [];
        document.getElementById('review-table-body').replaceChildren();
        document.getElementById('select-all').checked = false;
    }

    async loadRows() {
        this.setStatus('Loading...');
        const sb = this.sb;
        let rows;
        try {
            // Never select the `json` column here: thousands of rows would be too heavy.
            rows = await fetchAllPages(async (from, to) => {
                const { data, error } = await sb
                    .from('submissions')
                    .select('id,created_at,dataset_id,task_id,json_size,fully_solved,review_status,downloaded_at')
                    .order('id', { ascending: false })
                    .range(from, to);
                if (error) {
                    throw error;
                }
                return data;
            });
        } catch (error) {
            console.error('loadRows failed', error);
            this.setStatus('Error: ' + (error?.message ?? error));
            return;
        }
        this.renderRows(rows);
        if (rows.length == 0) {
            this.setStatus('No submissions (or this account is not the admin)');
        } else {
            this.setStatus(`${rows.length} submission(s)`);
        }
    }

    renderRows(rows) {
        this.clearTable();
        const tbody = document.getElementById('review-table-body');
        for (const row of rows) {
            const tr = document.createElement('tr');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'row-select';
            checkbox.value = String(row.id);
            const checkboxCell = document.createElement('td');
            checkboxCell.appendChild(checkbox);
            tr.appendChild(checkboxCell);

            const cells = [
                [String(row.id), false],
                [row.created_at ?? '', false],
                [row.dataset_id ?? '', false],
                [row.task_id ?? '', false],
                [String(row.json_size ?? ''), true],
                [String(row.fully_solved), false],
                [row.review_status ?? '', false],
                [row.downloaded_at ?? '', false],
            ];
            for (const [text, numeric] of cells) {
                const td = document.createElement('td');
                td.textContent = text;
                if (numeric) {
                    td.className = 'numeric';
                }
                tr.appendChild(td);
            }

            const linkCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = 'history.html?submissionId=' + encodeURIComponent(String(row.id));
            link.textContent = 'History';
            linkCell.appendChild(link);
            tr.appendChild(linkCell);

            tbody.appendChild(tr);
            this.entries.push({ row: row, checkbox: checkbox });
        }
        document.getElementById('review-table').classList.remove('hidden');
    }

    selectAllCheckbox(element) {
        for (const entry of this.entries) {
            entry.checkbox.checked = element.checked;
        }
    }

    selectedRows() {
        return this.entries.filter(entry => entry.checkbox.checked).map(entry => entry.row);
    }

    async reviewDownloadSelected() {
        if (this.busy) {
            return;
        }
        const selected = this.selectedRows();
        if (selected.length == 0) {
            alert('No rows selected!');
            return;
        }
        const notApprovedCount = selected.filter(row => row.review_status != 'approved').length;
        if (notApprovedCount > 0) {
            const isConfirmed = confirm(`${notApprovedCount} of ${selected.length} selected row(s) are not approved (pending or rejected). They will be included in the file and imported into the dataset. Continue?`);
            if (!isConfirmed) {
                return;
            }
        }
        const ids = selected.map(row => row.id);
        this.setBusy(true);
        try {
            this.setStatus(`Downloading ${ids.length} rows...`);
            const fullRows = [];
            for (const batch of chunk(ids, 100)) {
                const { data, error } = await this.sb
                    .from('submissions')
                    .select('id,created_at,review_status,fully_solved,update_uuid,json,json_size')
                    .in('id', batch);
                if (error) {
                    throw error;
                }
                fullRows.push(...data);
            }
            if (fullRows.length != ids.length) {
                throw new Error(`Expected ${ids.length} rows but fetched ${fullRows.length}`);
            }

            const text = JSON.stringify(buildReviewExport(fullRows), null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = reviewExportFilename(new Date());
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            const downloadedAt = new Date().toISOString();
            for (const batch of chunk(ids, 100)) {
                const { error } = await this.sb
                    .from('submissions')
                    .update({ downloaded_at: downloadedAt })
                    .in('id', batch);
                if (error) {
                    throw error;
                }
            }
            await this.loadRows();
        } catch (error) {
            console.error('reviewDownloadSelected failed', error);
            alert('Error downloading rows: ' + (error?.message ?? error));
            // Reload anyway: some rows may already have been marked as downloaded.
            await this.loadRows();
        } finally {
            this.setBusy(false);
        }
    }

    async reviewDeleteSelected() {
        if (this.busy) {
            return;
        }
        const selected = this.selectedRows();
        if (selected.length == 0) {
            alert('No rows selected!');
            return;
        }
        const { safeIds, unsafeIds } = partitionRowsForDelete(selected);
        if (unsafeIds.length > 0) {
            const isConfirmed = confirm(`${unsafeIds.length} selected row(s) are not downloaded and not rejected. OK = delete only the ${safeIds.length} downloaded/rejected row(s). Cancel = abort.`);
            if (!isConfirmed) {
                return;
            }
            if (safeIds.length == 0) {
                alert('Nothing to delete: none of the selected rows are downloaded or rejected.');
                return;
            }
        } else {
            const isConfirmed = confirm(`Are you sure you want to delete ${safeIds.length} selected row(s)?`);
            if (!isConfirmed) {
                return;
            }
        }
        this.setBusy(true);
        try {
            this.setStatus(`Deleting ${safeIds.length} rows...`);
            for (const batch of chunk(safeIds, 100)) {
                // The server-side predicate repeats partitionRowsForDelete's rule, in case the list is stale.
                const { error } = await this.sb
                    .from('submissions')
                    .delete()
                    .in('id', batch)
                    .or('downloaded_at.not.is.null,review_status.eq.rejected');
                if (error) {
                    throw error;
                }
            }
            await this.loadRows();
        } catch (error) {
            console.error('reviewDeleteSelected failed', error);
            alert('Error deleting rows: ' + (error?.message ?? error));
            // Reload anyway: some batches may already have been deleted.
            await this.loadRows();
        } finally {
            this.setBusy(false);
        }
    }
}

var gPageController = null;

function body_onload() {
    gPageController = new PageController();
    (async () => {
        await gPageController.onload();
    })();
}
