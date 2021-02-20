/* global React ReactDOM */
import {sfConn, apiVersion} from "./inspector.js";
import {groupByThree} from "./lists.js";
import {DataSet, Network} from "./vis-network.js";
/* global initButton */

/*
 Visualisation of metadata component dependencies using the Metadata Component Dependency API (Beta).

 Metadata components are determined by a DescribeMetadata followed by a ListMetadata call to retrieve
 a list of all metadata components in the org. This includes a query for all folders of metadata types
 in folders followed by queries for the corresponding metadata components within those folders.
 Then all metadata components without an Id are filtered out as currently the Metadata Component
 Dependency API can not query for dependencies by Type and Name. So we wouldn't be able to retrieve
 any dependencies anyway for a metadata component without an Id.

 Todos:
 - Allow filtering in the visualisation
 */

class DependenciesModel {
  constructor() {
    this.onModelChanged = null;
    this.onStatusChanged = null;
    this.orgMetadataTypes = [];
    this.orgMetadataComponents = new Map();
    this.rootNodes = [];
    this.nodes = [];
    this.dependencies = [];
    this.runningPromises = 0;
    this.statusMessage = "";
    this.errorMessage = "";
    this.metadataApi = sfConn.wsdl(apiVersion, "Metadata");

    this.recordMetadataComponent = this.recordMetadataComponent.bind(this);
    this.listMetadata = this.listMetadata.bind(this);
    this.listMetadataFromDescribeMetadataResult = this.listMetadataFromDescribeMetadataResult.bind(this);
  }

  modelChanged(modelChange) {
    if (this.onModelChanged) {
      this.onModelChanged(modelChange);
    }
  }

  statusChanged(statusChange) {
    if (this.onStatusChanged) {
      this.onStatusChanged(statusChange);
    }
  }

  recordMetadataComponent(metadataComponent) {
    if (!metadataComponent.id) {
      // Ignore metadata components without an Id, for which we can't query dependencies
      return;
    }

    if (!this.orgMetadataComponents.has(metadataComponent.type)) {
      this.orgMetadataComponents.set(metadataComponent.type, []);
    }
    let orgMetadataComponent = {
      id: metadataComponent.id,
      name: metadataComponent.fullName,
      type: metadataComponent.type,
      createdDate: metadataComponent.createdDate,
      createdBy: metadataComponent.createdByName,
      lastModifiedDate: metadataComponent.lastModifiedDate,
      lastModifiedBy: metadataComponent.lastModifiedByName,
      fileName: metadataComponent.fileName,
      manageableState: metadataComponent.manageableState,
    };
    if (metadataComponent.namespacePrefix) {
      orgMetadataComponent.namespace = metadataComponent.namespacePrefix;
    }
    this.orgMetadataComponents.get(metadataComponent.type).push(orgMetadataComponent);
  }

  listMetadata(metadataQueries) {
    let metadataQueryGroups = groupByThree(metadataQueries);

    this.runningPromises++;
    this.statusMessage = "Retrieving all metadata components (ListMetadata)";
    this.statusChanged();
    Promise.all(metadataQueryGroups.map((group) => sfConn.soap(this.metadataApi, "listMetadata", {queries: group})))
      .then((res) => {
        res.forEach((listMetadataResult) => {
          if (listMetadataResult) {
            let metadataResultArray = Array.isArray(listMetadataResult) ? listMetadataResult : Array.of(listMetadataResult);
            metadataResultArray.map(this.recordMetadataComponent);
          }
        });
        this.modelChanged();
      })
      .catch((err) => {
        console.error("Metadata API listMetadata call failed", err);
        this.errorMessage = "ListMetadata call failed: " + err.message;
      })
      .catch((err) => console.log("Failed", err))
      .finally(() => {
        this.runningPromises--;
        this.statusChanged();
      });
  }

  createListMetadataQuery(metadataType) {
    let metadataFolderToType = new Map([
      ["DashboardFolder", "Dashboard"],
      ["DocumentFolder", "Document"],
      ["EmailFolder", "EmailTemplate"],
      ["ReportFolder", "Report"],
    ]);

    if (metadataType.type && metadataFolderToType.has(metadataType.type)) {
      return {type: metadataFolderToType.get(metadataType.type), folder: metadataType.fullName};
    } else if (metadataType.xmlName) {
      return {type: metadataType.xmlName};
    } else {
      return {type: metadataType};
    }
  }

  listMetadataFromDescribeMetadataResult(describeMetadataResult) {
    this.orgMetadataTypes = Array.from(describeMetadataResult.metadataObjects).sort((a, b) => a.xmlName.localeCompare(b.xmlName));

    let metadataTypeToFolder = new Map([
      ["Dashboard", "DashboardFolder"],
      ["Document", "DocumentFolder"],
      ["EmailTemplate", "EmailFolder"],
      ["Report", "ReportFolder"],
    ]);

    const notInFolder = (metadataType) => !metadataTypeToFolder.has(metadataType.xmlName);

    let listMetadataQueries = this.orgMetadataTypes.filter(notInFolder).map(this.createListMetadataQuery);

    const hasChildrenTypes = (metadataType) => metadataType.childXmlNames;

    this.orgMetadataTypes.filter(hasChildrenTypes).forEach((metadataType) => {
      let metadataChildXmlNames = Array.isArray(metadataType.childXmlNames) ? metadataType.childXmlNames : Array.of(metadataType.childXmlNames);
      Array.prototype.push.apply(listMetadataQueries, metadataChildXmlNames.map(this.createListMetadataQuery));
    });

    const inFolder = (metadataType) => metadataTypeToFolder.has(metadataType.xmlName);

    let metadataInFolders = this.orgMetadataTypes.filter(inFolder);

    this.runningPromises++;
    this.statusMessage = "Retrieving metadata folders (for Documents, Reports, Dashboards, EmailTemplates)";
    this.statusChanged();
    Promise.all(metadataInFolders.map((metadataObject) => sfConn.soap(this.metadataApi, "listMetadata", {queries: {type: metadataTypeToFolder.get(metadataObject.xmlName)}})))
      .then((metadataFoldersByType) => {
        const createListMetadataQueriesFromMetadataFolders = (metadataFolders) => {
          let metadataFolderArray = Array.isArray(metadataFolders) ? metadataFolders : Array.of(metadataFolders);
          Array.prototype.push.apply(listMetadataQueries, metadataFolderArray.map(this.createListMetadataQuery));
        };

        metadataFoldersByType.forEach(createListMetadataQueriesFromMetadataFolders);

        this.listMetadata(listMetadataQueries);
      })
      .catch((err) => {
        console.error("Metadata API listMetadata for Metadata Folders failed", err);
        this.errorMessage = "ListMetadata call for Metadata Folders failed: " + err.message;
      })
      .catch((err) => console.log("Failed", err))
      .finally(() => {
        this.runningPromises--;
        this.statusChanged();
      });
  }

  startLoadingMegadata() {
    this.runningPromises++;
    this.statusMessage = "Retrieving all metadata types (DescribeMetadata)";
    this.statusChanged();
    sfConn.soap(this.metadataApi, "describeMetadata", {})
      .then(this.listMetadataFromDescribeMetadataResult)
      .catch((err) => {
        console.error("Metadata API describeMetadata call failed", err);
        this.errorMessage = "DescribeMetadata call failed: " + err.message;
      })
      .catch((err) => console.log("Failed", err))
      .finally(() => {
        this.runningPromises--;
        this.statusChanged();
      });
  }

  findMetadataComponent(type, id) {
    if (this.orgMetadataComponents.has(type)) {
      return this.orgMetadataComponents.get(type).find((value) => value.id === id);
    }
    return undefined;
  }

  addMetadataComponentId(id) {
    let query = `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentNamespace, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentNamespace, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentId = '${id}' OR RefMetadataComponentId = '${id}'`;

    let orgMetadataComponent = Array.from(this.orgMetadataComponents.values())
      .map((components) => components.find((component) => component.id === id))
      .find((component) => component);

    this.runningPromises++;
    this.statusMessage = `Retrieving metadata dependencies of component ${orgMetadataComponent.type} ${orgMetadataComponent.name}`;
    this.statusChanged();
    sfConn.rest("/services/data/v" + apiVersion + "/tooling/query/" + "?q=" + query)
      .then(res => {
        if (res && res.size) {
          const idEquals = (someId) => ((val) => val.id === someId);

          res.records.forEach(cmpDependency => {
            let referencingNode = {
              id: cmpDependency.MetadataComponentId,
              name: cmpDependency.MetadataComponentName,
              namespace: cmpDependency.MetadataComponentNamespace,
              type: cmpDependency.MetadataComponentType,
              isRootNode: false,
            };

            let referencingMetadataComponent = this.findMetadataComponent(referencingNode.type, referencingNode.id);
            if (referencingMetadataComponent) {
              referencingNode.name = referencingMetadataComponent.name;
              referencingNode.createdDate = referencingMetadataComponent.createdDate;
              referencingNode.lastModifiedDate = referencingMetadataComponent.lastModifiedDate;
            }

            if (referencingNode.id === id && this.rootNodes.findIndex(idEquals(referencingNode.id)) < 0) {
              referencingNode.isRootNode = true;
              this.rootNodes.push(referencingNode);
            }

            if (this.nodes.findIndex(idEquals(referencingNode.id)) < 0) {
              this.nodes.push(referencingNode);
            }

            let referencedNode = {
              id: cmpDependency.RefMetadataComponentId,
              name: cmpDependency.RefMetadataComponentName,
              namespace: cmpDependency.RefMetadataComponentNamespace,
              type: cmpDependency.RefMetadataComponentType,
              isRootNode: false,
            };

            let referencedMetadataComponent = this.findMetadataComponent(referencedNode.type, referencedNode.id);
            if (referencedMetadataComponent) {
              referencedNode.name = referencedMetadataComponent.name;
              referencedNode.createdDate = referencedMetadataComponent.createdDate;
              referencedNode.lastModifiedDate = referencedMetadataComponent.lastModifiedDate;
            }

            if (referencedNode.id === id && this.rootNodes.findIndex(idEquals(referencedNode.id)) < 0) {
              referencedNode.isRootNode = true;
              this.rootNodes.push(referencedNode);
            }

            if (this.nodes.findIndex(idEquals(referencedNode.id)) < 0) {
              this.nodes.push(referencedNode);
            }

            if (this.dependencies.findIndex(value => value.from.id === referencingNode.id && value.to.id === referencedNode.id) < 0) {
              this.dependencies.push({from: referencingNode, to: referencedNode});
            }

            this.modelChanged();
          });
        } else {
          this.errorMessage = `No metadata dependencies of component ${orgMetadataComponent.type} ${orgMetadataComponent.name} found`;
        }
      })
      .catch(err => {
        console.error("Tooling API Query for MetadataComponentDependency failed", err);
        this.errorMessage = "Query for MetadataComponentDependency failed: " + err.message;
      })
      .catch(err => console.log("Failed", err))
      .finally(() => {
        this.runningPromises--;
        this.statusChanged();
      });
  }

  removeMetadataComponentRoot(cmp) {
    let modelChanged = false;

    let newDependencies = this.dependencies.filter((dependency) => dependency.from.id !== cmp.id && dependency.to.id !== cmp.id);
    if (newDependencies.length !== this.dependencies.length) {
      this.dependencies = newDependencies;
      modelChanged = true;
    }

    let newNodes = this.nodes.filter((node) => node.id !== cmp.id && newDependencies.some((dependency) => dependency.from.id === node.id || dependency.to.id === node.id));
    if (newNodes.length !== this.nodes.length) {
      this.nodes = newNodes;
      modelChanged = true;
    }

    let newRootNodes = this.rootNodes.filter((rootNode) => rootNode.id !== cmp.id);
    if (newRootNodes.length !== this.rootNodes.length) {
      this.rootNodes = newRootNodes;
      modelChanged = true;
    }

    if (modelChanged) {
      this.modelChanged();
    }
  }

  clearErrorMessage(msg) {
    if (this.errorMessage === msg) {
      this.errorMessage = "";
      this.statusChanged();
    }
  }
}

let h = React.createElement;

function SalesforceLink(props) {
  return h(
    "a",
    {
      href: props.sfLink,
      className: "sf-link"
    },
    h(
      "svg",
      {
        viewBox: "0 0 24 24"
      },
      h(
        "path",
        {
          d: "M18.9 12.3h-1.5v6.6c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-5.1h-3.6v5.1c0 .2-.1.3-.3.3h-3c-.2 0-.3-.1-.3-.3v-6.6H5.1c-.1 0-.3-.1-.3-.2s0-.2.1-.3l6.9-7c.1-.1.3-.1.4 0l7 7v.3c0 .1-.2.2-.3.2z"
        }
      )
    ),
    " Salesforce Home"
  );
}

class MetadataComponentInput extends React.Component {
  constructor(props) {
    super(props);

    this.metadataComponents = props.metadataComponents;

    this.state = {componentType: "", componentId: ""};

    this.handleTypeChange = this.handleTypeChange.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleTypeChange(event) {
    this.setState({componentType: event.target.value, componentId: ""});
  }

  handleNameChange(event) {
    this.setState({componentId: event.target.value});
  }

  handleSubmit(event) {
    this.props.onAddMetadataComponent(this.state.componentId);
    this.setState({componentId: ""});
    event.preventDefault();
  }

  render() {
    let dummyComponentTypeOption = h("option", {key: "DUMMY", value: ""}, "Please select metadata type");
    let metadataComponentTypeOptions = Array.from(this.metadataComponents.keys()).sort().map((cmp) => h("option", {key: cmp, value: cmp}, cmp));
    let componentTypeSelectOptions = [dummyComponentTypeOption].concat(metadataComponentTypeOptions);

    let metadataComponentOptions = h("option", null, "Select metadata type");
    if (this.state.componentType) {
      let dummyOption = h("option", {key: "DUMMY", value: ""}, "Please select metadata component");
      let metadataComponents = this.metadataComponents.get(this.state.componentType).sort((a, b) => a.name.localeCompare(b.name));
      let metadataOptions = metadataComponents.map((cmp) => h("option", {key: cmp.id, value: cmp.id}, cmp.name));
      metadataComponentOptions = [dummyOption].concat(metadataOptions);
    }

    return h(
      "form",
      {onSubmit: this.handleSubmit},
      h(
        "label",
        {
          className: "dependency-input_label",
          htmlFor: "metadataComponentTypeInput",
        },
        "Metadata Type"
      ),
      h(
        "select",
        {
          id: "metadataComponentTypeInput",
          name: "metadataComponentType",
          value: this.state.componentType,
          disabled: this.metadataComponents.size == 0,
          onChange: this.handleTypeChange,
        },
        componentTypeSelectOptions
      ),
      h(
        "label",
        {
          className: "dependency-input_label",
          htmlFor: "metadataComponentIdInput",
        },
        "Metadata Component"
      ),
      h(
        "select",
        {
          id: "metadataComponentIdInput",
          name: "metadataComponentId",
          value: this.state.componentId,
          disabled: !this.state.componentType,
          onChange: this.handleNameChange,
        },
        metadataComponentOptions
      ),
      // h(
      //   "input",
      //   {
      //     type: "text",
      //     id: "metadataComponentIdInput",
      //     name: "metadataComponentId",
      //     placeholder: "Metadata Id",
      //     pattern: "[0-9A-Za-z]{18}",
      //     value: this.state.value,
      //     onChange: this.handleChange
      //   }
      // ),
      h(
        "input",
        {
          className: "dependency-input_submit",
          type: "submit",
          value: "+"
        }
      )
    );
  }
}

function DependencyRootRemove(props) {
  let handleClick = (event) => {
    props.onRemove(event);
  };
  return h(
    "span",
    {
      className: "dependency-root__remove",
      title: "Remove",
      onClick: handleClick
    },
    h(
      "svg",
      {
        viewBox: "0 0 52 52",
      },
      h(
        "path",
        {
          d: "M31 25.4l13-13.1c.6-.6.6-1.5 0-2.1l-2-2.1c-.6-.6-1.5-.6-2.1 0L26.8 21.2c-.4.4-1 .4-1.4 0L12.3 8c-.6-.6-1.5-.6-2.1 0l-2.1 2.1c-.6.6-.6 1.5 0 2.1l13.1 13.1c.4.4.4 1 0 1.4L8 39.9c-.6.6-.6 1.5 0 2.1l2.1 2.1c.6.6 1.5.6 2.1 0L25.3 31c.4-.4 1-.4 1.4 0l13.1 13.1c.6.6 1.5.6 2.1 0L44 42c.6-.6.6-1.5 0-2.1L31 26.8c-.4-.4-.4-1 0-1.4z"
        }
      )
    )
  );
}

function DependencyRoot(props) {
  let handleRemove = () => {
    props.onRemove(props.root);
  };
  return h(
    "li",
    {
      className: "dependencies-listbox-item",
      role: "presentation",
    },
    h(
      "span",
      {
        className: "dependency-root",
        role: "option",
        tabIndex: 0,
        "aria-selected": true,
      },
      h("span", {className: "dependency-root__type", title: props.root.type}, props.root.type),
      h("span", {className: "dependency-root__name", title: props.root.name}, props.root.name),
      h(DependencyRootRemove, {onRemove: handleRemove})
    )
  );
}

function DependenciesRoots(props) {
  let handleRemoveDependencyRoot = (cmp) => {
    props.onRemoveMetadataComponent(cmp);
  };
  return h(
    "div",
    {className: "dependency-roots_container"/*"dependency-roots_container"*/},
    h(
      "ul",
      {
        className: "dependencies-listbox",
        role: "listbox",
        "aria-label": "Selected Component Roots",
        "aria-orientation": "horizontal",
      },
      props.roots.map(r => h(DependencyRoot, {key: r.id, root: r, onRemove: handleRemoveDependencyRoot}))
    )
  );
}

function MetadataDependencyRow(props) {
  return h(
    "tr",
    null,
    h("td", null, props.from.id),
    h("td", null, props.from.name),
    h("td", null, props.from.type),
    h("td", null, props.to.id),
    h("td", null, props.to.name),
    h("td", null, props.to.type),
  );
}

function MetadataDependenciesTable(props) {
  return h(
    "table",
    null,
    h(
      "thead",
      null,
      h(
        "tr",
        null,
        h("th", {colSpan: 3}, "Referencing Component"),
        h("th", {colSpan: 3}, "Referenced Component"),
      ),
      h(
        "tr",
        null,
        h("th", null, "Id"),
        h("th", null, "Name"),
        h("th", null, "Type"),
        h("th", null, "Id"),
        h("th", null, "Name"),
        h("th", null, "Type"),
      )
    ),
    h(
      "tbody",
      null,
      props.dependencies.map(dep => h(MetadataDependencyRow, {from: dep.from, to: dep.to, key: dep.from.id + dep.to.id}))
    )
  );
}

const COLOR_PALETTE = [
  "#52B7D8",
  "#E16032",
  "#FFB03B",
  "#54A77B",
  "#4FD2D2",
  "#E287B2",
];

class MetadataDependenciesGraph extends React.Component {
  constructor(props) {
    super(props);

    this.nodeTypeColors = new Map();
    this.network = null;
    this.containerRef = null;

    this.setContainerRef = (element) => {
      this.containerRef = element;
    };
  }

  createNodeTypeColors(nodes) {
    let nodeTypeCounts = nodes.reduce((prev, curr) => {
      if (!prev.has(curr.type)) {
        prev.set(curr.type, 0);
      }
      let count = prev.get(curr.type) + 1;
      prev.set(curr.type, count);
      return prev;
    }, new Map());

    let nodeTypesByCount = Array.from(nodeTypeCounts.entries()).sort((a, b) => b[1] - a[1]);

    let nodeTypeColors = new Map(nodeTypesByCount.map((entry, index) => {
      let nodeType = entry[0];
      let color = COLOR_PALETTE[Math.min(index, COLOR_PALETTE.length - 1)];
      return [nodeType, color];
    }));

    return nodeTypeColors;
  }

  createNetwork(container, nodes, dependencies) {
    let nodeTitle = (node) =>
      `<ul class="dependency-node-details">
      <li>${node.type}</li>
      <li>${node.name}</li>
      <li>Id: ${node.id}</li>
      <li>Created: ${node.createdDate}</li>
      <li>Last Modified: ${node.lastModifiedDate}</li>
      </ul>`;

    let visNodes = new DataSet(
      nodes.map((node, idx) => ({
        id: (node.id ? node.id : idx),
        label: node.name,
        title: nodeTitle(node),
        color: this.nodeTypeColors.get(node.type),
      }))
    );
    let visEdges = new DataSet(
      dependencies.map(dependency => ({
        from: dependency.from.id,
        to: dependency.to.id
      }))
    );
    let data = {
      nodes: visNodes,
      edges: visEdges,
    };
    let options = {
      layout: {
        hierarchical: {
          direction: "UD",
          sortMethod: "directed"
        }
      },
      // manipulation: {
      //   enabled: false,
      // },
      physics: {
        hierarchicalRepulsion: {
          avoidOverlap: 1.0
        }
      }
    };
    // if (nodes.length > 0) {
    //   options.manipulation.enabled = false;
    //   options.manipulation.addNode = false;
    //   options.manipulation.addEdge = false;
    //   options.manipulation.editNode = (nodeData, callback) => {
    //     console.log("Editing Node: ", nodeData);
    //     callback(nodeData);
    //   };
    //   options.manipulation.editEdge = false;
    //   options.manipulation.deleteNode = false;
    //   options.manipulation.deleteEdge = false;
    // }

    return new Network(container, data, options);
  }

  componentDidUpdate() {
    if (this.network) {
      this.network.destroy();
    }

    this.network = this.createNetwork(this.containerRef, this.props.nodes, this.props.dependencies);
    // this.network.on("oncontext", (params) => {
    //   console.log("OnContext: ", JSON.stringify(params));
    //   params.event.preventDefault();
    // });
  }

  componentWillUnmount() {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
  }

  render() {
    this.nodeTypeColors = this.createNodeTypeColors(this.props.nodes);

    let arrayNodeTypeColors = Array.from(this.nodeTypeColors);
    let nodeColorLegend = arrayNodeTypeColors.slice(0, Math.min(arrayNodeTypeColors.length, COLOR_PALETTE.length));
    if (arrayNodeTypeColors.length > COLOR_PALETTE.length) {
      nodeColorLegend[nodeColorLegend.length - 1][0] = "Others";
    }

    return h(
      "div",
      {
        className: "dependencies-graph_container"
      },
      h(
        "div",
        {
          className: "dependencies-graph_network",
          ref: this.setContainerRef
        }
      ),
      h(
        "div",
        {
          className: "dependencies-graph_sidebar"
        },
        h(
          "ul",
          {
            className: "dependencies-graph_legend"
          },
          nodeColorLegend.map((nodeColor, idx) => h(
            "li",
            {
              key: idx,
              style: {
                backgroundColor: nodeColor[1]
              }
            },
            nodeColor[0]
          ))
        )
      )
    );
  }
}

function LoadingIndicator(props) {
  return h(
    "section",
    {
      role: "dialog",
      className: "dependencies-modal" + (props.showStatus ? " dependencies-fade-in-open" : ""),
      "aria-modal": true,
    },
    h(
      "div",
      {
        className: "dependencies-modal__container",
      },
      h(
        "header",
        {
          className: "dependencies-modal__header",
        },
        h("img", {
          id: "spinner",
          src: "data:image/gif;base64,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",
        }),
      ),
      h(
        "div",
        {
          className: "dependencies-modal__content",
        },
        props.showMessages.map((msg, idx) => h("p", {key: idx, className: "status-message"}, msg))
      )
    )
  );
}

class MetadataDependencies extends React.Component {
  constructor(props) {
    super(props);

    this.model = this.props.model;

    this.handleModelChanged = this.handleModelChanged.bind(this);
    this.handleModelStatusChanged = this.handleModelStatusChanged.bind(this);
    this.handleAddMetadataComponent = this.handleAddMetadataComponent.bind(this);
    this.handleRemoveMetadataComponentRoot = this.handleRemoveMetadataComponentRoot.bind(this);

    this.model.onModelChanged = this.handleModelChanged;
    this.model.onStatusChanged = this.handleModelStatusChanged;

    let statusMessages = [];
    if (this.model.statusMessage) {
      statusMessages.push(this.model.statusMessage);
    }
    if (this.model.errorMessage) {
      statusMessages.push(this.model.errorMessage);
    }
    this.state = {
      metadataComponents: this.model.orgMetadataComponents,
      rootNodes: this.model.rootNodes,
      nodes: this.model.nodes,
      dependencies: this.model.dependencies,
      showStatus: this.model.runningPromises > 0 || this.model.errorMessage,
      showMessages: statusMessages,
    };
  }

  handleModelChanged() {
    this.setState({
      metadataComponents: this.model.orgMetadataComponents,
      rootNodes: this.model.rootNodes,
      nodes: this.model.nodes,
      dependencies: this.model.dependencies,
    });
  }

  handleModelStatusChanged() {
    let statusMessages = [];
    if (this.model.statusMessage) {
      statusMessages.push(this.model.statusMessage);
    }
    if (this.model.errorMessage) {
      let errorMessage = this.model.errorMessage;
      statusMessages.push(this.model.errorMessage);
      setTimeout(() => {
        this.model.clearErrorMessage(errorMessage);
      }, 2000);
    }
    this.setState({
      showStatus: this.model.runningPromises > 0 || this.model.errorMessage,
      showMessages: statusMessages,
    });
  }

  handleAddMetadataComponent(metadataComponentId) {
    this.model.addMetadataComponentId(metadataComponentId);
  }

  handleRemoveMetadataComponentRoot(metadataComponent) {
    this.model.removeMetadataComponentRoot(metadataComponent);
  }

  render() {
    return h(
      "div",
      null,
      h(LoadingIndicator, {showStatus: this.state.showStatus, showMessages: this.state.showMessages}),
      h("div", {className: "dependencies-backdrop" + (this.state.showStatus ? " dependencies-backdrop_open" : "")}),
      h(
        "div",
        {},
        h(
          "div",
          null,
          h(
            "div",
            {
              className: "dependencies-header-left",
            },
            this.props.children
          ),
          h(
            "div",
            {
              className: "dependencies-header-center",
            },
            h(MetadataComponentInput, {metadataComponents: this.state.metadataComponents, onAddMetadataComponent: this.handleAddMetadataComponent}),
          ),
          h(DependenciesRoots, {roots: this.state.rootNodes, onRemoveMetadataComponent: this.handleRemoveMetadataComponentRoot})
        ),
        h(
          "div",
          {
            id: "dependency-table"
          },
          h(MetadataDependenciesTable, {dependencies: this.state.dependencies}),
        ),
        h(MetadataDependenciesGraph, {nodes: this.state.nodes, dependencies: this.state.dependencies}),
      )
    );
  }
}

class App extends React.Component {
  render() {
    document.title = "Metadata Dependencies (Beta)";

    let dependenciesModel = new DependenciesModel();
    dependenciesModel.startLoadingMegadata();

    return h(
      MetadataDependencies,
      {model: dependenciesModel},
      h(SalesforceLink, {sfLink: "https://" + this.props.sfHost})
    );
  }
}

{
  let args = new URLSearchParams(location.search.slice(1));
  let sfHost = args.get("host");
  initButton(sfHost, true);
  sfConn.getSession(sfHost).then(() => {
    ReactDOM.render(
      h(App, {sfHost}),
      document.getElementById("root")
    );
  });
}
