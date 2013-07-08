function init(){
}

function addRowToDataTable(cellData){
    var tableRow = document.createElement('tr');
    for (var i = 0; i < cellData.length; i++) {
        var tableCell = document.createElement('td');
        tableCell.innerHTML = cellData[i];
        tableRow.appendChild(tableCell);
    }
    document.querySelector('#dataTableBody').appendChild(tableRow);
}

document.addEventListener('DOMContentLoaded', init);
