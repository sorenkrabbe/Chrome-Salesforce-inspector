
function groupByThree(list) {
  let groups = [];
  for (let element of list) {
    if (groups.length == 0 || groups[groups.length - 1].length == 3) {
      groups.push([]);
    }
    groups[groups.length - 1].push(element);
  }
  return groups;
}

export {groupByThree};
