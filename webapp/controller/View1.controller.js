sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/TableSelectDialog",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox,
    TableSelectDialog,
    Column,
    ColumnListItem,
    Text
) {
    "use strict";

    return Controller.extend("zpp4pointinsp.controller.View1", {

        onInit: function () {
            var oViewModel = new JSONModel({
                busy: false,

                productionOrders: [],

                operators: [
                    { key: "", text: "Select Operator" }
                ],

                machines: [
                    { key: "", text: "Select Machine" }
                ],

                storageLocations: [
                    { key: "1226", text: "1226" },
                    { key: "1227", text: "1227" }
                ],

                shifts: [
                    { key: "A", text: "A" },
                    { key: "B", text: "B" }
                ],

                // Will come from backend Process endpoint
                processes: [],

                // Will come from backend Defect endpoint
                allDefects: [],
                currentDefects: [],

                capturedDefects: [],

                selection: {
                    productionOrder: "",
                    salesOrder: "",
                    salesOrderItem: "",
                    product: "",
                    productDescription: "",
                    quantity: "",
                    uom: "",
                    fromStorageLocation: "1225",
                    toStorageLocation: "1226",
                    shift: "A",
                    inspectedQuantity: "",
                    inspectedUom: "",
                    netWeight: "",
                    grossWeight: "",
                    tareWeight: "",

                    // ProcessID UUID will be stored here
                    process: "",
                    processName: "",

                    meterReading: "",
                    operator: "",
                    machineName: ""
                }
            });

            oViewModel.setSizeLimit(5000);
            this.getView().setModel(oViewModel, "vm");

            this._loadProductionOrders();
            this._loadProcessAndDefectMaster();
            this._loadOperatorAndMachineMaster();
        },

        _getServiceUrl: function () {
            var oSapApp = this.getOwnerComponent().getManifestEntry("sap.app");
            var sServiceUrl = oSapApp.dataSources.mainService.uri;

            return sServiceUrl.replace(/\/?$/, "/");
        },

        _readEndpoint: function (sEndpoint, sQuery) {
            var sRequestUrl = this._getServiceUrl() + sEndpoint;

            if (sQuery) {
                sRequestUrl += "?" + sQuery;
            }

            return fetch(sRequestUrl, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            }).then(function (oResponse) {
                if (!oResponse.ok) {
                    throw new Error(oResponse.status + " " + oResponse.statusText);
                }

                return oResponse.json();
            });
        },

        _toArray: function (oResponseData) {
            return Array.isArray(oResponseData) ?
                oResponseData :
                (
                    oResponseData.value ||
                    (oResponseData.d && oResponseData.d.results) ||
                    []
                );
        },

        _loadProcessAndDefectMaster: function () {
            var oViewModel = this.getView().getModel("vm");

            oViewModel.setProperty("/busy", true);

            Promise.all([
                this._readEndpoint("Process", "$top=5000"),
                this._readEndpoint("Defect", "$top=5000")
            ])
                .then(function (aResponses) {
                    var aProcessResponse = this._toArray(aResponses[0]);
                    var aDefectResponse = this._toArray(aResponses[1]);

                    var aProcesses = aProcessResponse.map(function (oItem) {
                        return {
                            key: oItem.ProcessID,
                            text: oItem.ProcessName
                        };
                    });

                    var aDefects = aDefectResponse.map(function (oItem) {
                        return {
                            processId: oItem.ProcessID,
                            defectCode: oItem.DefectCode,
                            processName: oItem.ProcessName,
                            name: oItem.DefectName
                        };
                    });

                    oViewModel.setProperty("/processes", aProcesses);
                    oViewModel.setProperty("/allDefects", aDefects);

                    if (aProcesses.length > 0) {
                        var oFirstProcess = aProcesses[0];

                        oViewModel.setProperty("/selection/process", oFirstProcess.key);
                        oViewModel.setProperty("/selection/processName", oFirstProcess.text);

                        this._setCurrentDefectsByProcess(oFirstProcess.key);
                    }
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(
                        "Unable to load Process / Defect master data.\n\n" +
                        (oError.message || "Please check Process and Defect endpoints.")
                    );
                })
                .finally(function () {
                    oViewModel.setProperty("/busy", false);
                });
        },

        _loadOperatorAndMachineMaster: function () {
            var oViewModel = this.getView().getModel("vm");

            oViewModel.setProperty("/busy", true);

            Promise.all([
                this._readEndpoint("operator_name", "$top=5000"),
                this._readEndpoint("Machine_name", "$top=5000")
            ])
                .then(function (aResponses) {
                    var aOperatorResponse = this._toArray(aResponses[0]);
                    var aMachineResponse = this._toArray(aResponses[1]);

                    var aOperators = [{
                        key: "",
                        text: "Select Operator"
                    }].concat(aOperatorResponse.map(function (oItem) {
                        return {
                            key: oItem.OperatorName,
                            text: oItem.OperatorName
                        };
                    }));

                    var aMachines = [{
                        key: "",
                        text: "Select Machine"
                    }].concat(aMachineResponse.map(function (oItem) {
                        return {
                            key: oItem.MachineName,
                            text: oItem.MachineName
                        };
                    }));

                    oViewModel.setProperty("/operators", aOperators);
                    oViewModel.setProperty("/machines", aMachines);
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(
                        "Unable to load Operator / Machine master data.\n\n" +
                        (oError.message || "Please check operator_name and Machine_name endpoints.")
                    );
                })
                .finally(function () {
                    oViewModel.setProperty("/busy", false);
                });
        },

        _setCurrentDefectsByProcess: function (sProcessId) {
            var oViewModel = this.getView().getModel("vm");
            var aAllDefects = oViewModel.getProperty("/allDefects") || [];

            var aCurrentDefects = aAllDefects.filter(function (oDefect) {
                return String(oDefect.processId) === String(sProcessId);
            });

            oViewModel.setProperty("/currentDefects", aCurrentDefects);
        },

        _loadProductionOrders: function () {
            var oViewModel = this.getView().getModel("vm");
            var sRequestUrl = this._getServiceUrl() + "productordvh?$top=1000";

            oViewModel.setProperty("/busy", true);

            fetch(sRequestUrl, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json"
                }
            })
                .then(function (oResponse) {
                    if (!oResponse.ok) {
                        throw new Error(oResponse.status + " " + oResponse.statusText);
                    }

                    return oResponse.json();
                })
                .then(function (oResponseData) {
                    var aProductionOrders = Array.isArray(oResponseData) ?
                        oResponseData :
                        (
                            oResponseData.value ||
                            (oResponseData.d && oResponseData.d.results) ||
                            []
                        );

                    oViewModel.setProperty("/productionOrders", aProductionOrders);
                })
                .catch(function (oError) {
                    MessageBox.error(
                        "Unable to load Production Order value help.\n\n" +
                        (oError.message || "Please check the productordvh endpoint.")
                    );
                })
                .finally(function () {
                    oViewModel.setProperty("/busy", false);
                });
        },

        onProductionOrderChange: function (oEvent) {
            var sProductionOrder = oEvent.getParameter("value").trim();
            var oViewModel = this.getView().getModel("vm");
            var aProductionOrders = oViewModel.getProperty("/productionOrders") || [];

            var oSelected = aProductionOrders.find(function (oItem) {
                return String(oItem.Product_Order) === String(sProductionOrder);
            });

            if (!oSelected) {
                this._clearProductionOrderDetails();
                oEvent.getSource().setValue(sProductionOrder);
                return;
            }

            this._setSelectedProductionOrder(oSelected);
        },

        onProductionOrderSuggest: function (oEvent) {
            var sValue = oEvent.getParameter("suggestValue");
            var oBinding = oEvent.getSource().getBinding("suggestionRows");

            if (oBinding) {
                oBinding.filter(this._createProductionOrderFilter(sValue));
            }
        },

        onProductionOrderSuggestionSelected: function (oEvent) {
            var oSelectedRow = oEvent.getParameter("selectedRow");
            var oContext = oSelectedRow && oSelectedRow.getBindingContext("vm");

            if (oContext) {
                this._setSelectedProductionOrder(oContext.getObject());
            }
        },

        onProductionOrderValueHelp: function () {
            if (!this._oProductionOrderDialog) {
                this._oProductionOrderDialog = new TableSelectDialog({
                    title: "Select Production Order",
                    noDataText: "No production orders found",
                    contentWidth: "55rem",
                    contentHeight: "32rem",
                    stretchOnPhone: true,
                    search: this.onProductionOrderValueHelpSearch.bind(this),
                    confirm: this.onProductionOrderValueHelpConfirm.bind(this),
                    columns: [
                        new Column({ header: new Text({ text: "Production Order" }) }),
                        new Column({ header: new Text({ text: "Sales Order" }) }),
                        new Column({ header: new Text({ text: "Item" }) })
                    ]
                });

                this._oProductionOrderDialog.bindAggregation("items", {
                    path: "vm>/productionOrders",
                    template: new ColumnListItem({
                        cells: [
                            new Text({ text: "{vm>Product_Order}" }),
                            new Text({ text: "{vm>SalesOrder}" }),
                            new Text({ text: "{vm>SalesOrderItem}" })
                        ]
                    })
                });

                this.getView().addDependent(this._oProductionOrderDialog);
            }

            this._oProductionOrderDialog.open();
        },

        onProductionOrderValueHelpSearch: function (oEvent) {
            var oBinding = oEvent.getSource().getBinding("items");

            if (oBinding) {
                oBinding.filter(this._createProductionOrderFilter(oEvent.getParameter("value")));
            }
        },

        onProductionOrderValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oContext = oSelectedItem && oSelectedItem.getBindingContext("vm");

            if (oContext) {
                this._setSelectedProductionOrder(oContext.getObject());
            }
        },

        _createProductionOrderFilter: function (sValue) {
            if (!sValue) {
                return [];
            }

            var aFilters = [
                new Filter("Product_Order", FilterOperator.Contains, sValue),
                new Filter("Product", FilterOperator.Contains, sValue),
                new Filter("ProductDescription", FilterOperator.Contains, sValue),
                new Filter("SalesOrder", FilterOperator.Contains, sValue),
                new Filter("SalesOrderItem", FilterOperator.Contains, sValue),
                new Filter("Uom", FilterOperator.Contains, sValue)
            ];

            var fQuantity = Number(sValue);

            if (Number.isFinite(fQuantity)) {
                aFilters.push(new Filter("Qty", FilterOperator.EQ, fQuantity));
            }

            return new Filter({
                filters: aFilters,
                and: false
            });
        },

        _setSelectedProductionOrder: function (oSelected) {
            var oViewModel = this.getView().getModel("vm");

            oViewModel.setProperty("/selection/productionOrder", oSelected.Product_Order || "");
            oViewModel.setProperty("/selection/salesOrder", oSelected.SalesOrder || "");
            oViewModel.setProperty("/selection/salesOrderItem", oSelected.SalesOrderItem || "");
            oViewModel.setProperty("/selection/product", oSelected.Product || "");
            oViewModel.setProperty("/selection/productDescription", oSelected.ProductDescription || "");

            oViewModel.setProperty(
                "/selection/quantity",
                oSelected.Qty === null || oSelected.Qty === undefined ? "" : String(oSelected.Qty)
            );

            oViewModel.setProperty("/selection/uom", oSelected.Uom || "");
        },

        _clearProductionOrderDetails: function () {
            var oViewModel = this.getView().getModel("vm");

            oViewModel.setProperty("/selection/productionOrder", "");
            oViewModel.setProperty("/selection/salesOrder", "");
            oViewModel.setProperty("/selection/salesOrderItem", "");
            oViewModel.setProperty("/selection/product", "");
            oViewModel.setProperty("/selection/productDescription", "");
            oViewModel.setProperty("/selection/quantity", "");
            oViewModel.setProperty("/selection/uom", "");
        },

        onProcessChange: function (oEvent) {
            var sProcessId = oEvent.getSource().getSelectedKey();
            var oViewModel = this.getView().getModel("vm");
            var aProcesses = oViewModel.getProperty("/processes") || [];

            var oSelectedProcess = aProcesses.find(function (oProcess) {
                return String(oProcess.key) === String(sProcessId);
            });

            oViewModel.setProperty("/selection/process", sProcessId);
            oViewModel.setProperty(
                "/selection/processName",
                oSelectedProcess ? oSelectedProcess.text : ""
            );

            this._setCurrentDefectsByProcess(sProcessId);
        },

        onWeightChange: function (oEvent) {
            var oViewModel = this.getView().getModel("vm");
            var oSource = oEvent && oEvent.getSource();
            var oValueBinding = oSource && oSource.getBinding("value");

            if (oValueBinding) {
                oViewModel.setProperty(oValueBinding.getPath(), oEvent.getParameter("value"));
            }

            var sGrossWeight = oViewModel.getProperty("/selection/grossWeight");
            var sTareWeight = oViewModel.getProperty("/selection/tareWeight");
            var fGrossWeight = Number(sGrossWeight);
            var fTareWeight = Number(sTareWeight);

            if (sGrossWeight === "" || sTareWeight === "" || !Number.isFinite(fGrossWeight) || !Number.isFinite(fTareWeight)) {
                oViewModel.setProperty("/selection/netWeight", "");
                return;
            }

            oViewModel.setProperty(
                "/selection/netWeight",
                (fGrossWeight - fTareWeight).toFixed(3)
            );
        },

        onMeterReadingSubmit: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var fMeterReading = Number(sValue);

            if (sValue === "" || !Number.isFinite(fMeterReading) || fMeterReading < 0) {
                MessageToast.show("Please enter a valid non-negative meter reading.");
                return;
            }

            this.getView().getModel("vm").setProperty(
                "/selection/meterReading",
                fMeterReading.toFixed(2)
            );
        },

        onDefectClick: function (oEvent) {
            var oViewModel = this.getView().getModel("vm");
            var oSelection = oViewModel.getProperty("/selection");

            if (!oSelection.productionOrder) {
                MessageToast.show("Please select Production Order first.");
                return;
            }

            if (!oSelection.salesOrder || !oSelection.product || !oSelection.quantity || !oSelection.uom) {
                MessageToast.show("Production Order details are missing.");
                return;
            }

            if (!oSelection.process) {
                MessageToast.show("Please select Process first.");
                return;
            }

            if (!oSelection.meterReading) {
                MessageToast.show("Please enter Meter Reading first.");
                return;
            }

            if (!oSelection.operator) {
                MessageToast.show("Please select Operator first.");
                return;
            }

            if (!oSelection.machineName) {
                MessageToast.show("Please select Machine Name first.");
                return;
            }

            var fMeterReading = Number(oSelection.meterReading);

            if (!Number.isFinite(fMeterReading) || fMeterReading < 0) {
                MessageToast.show("Please enter a valid non-negative Meter Reading.");
                return;
            }

            var oDefectContext = oEvent.getSource().getBindingContext("vm");
            var oDefect = oDefectContext ? oDefectContext.getObject() : {};

            var aCapturedDefects = (oViewModel.getProperty("/capturedDefects") || []).slice();

            aCapturedDefects.push({
                defectCode: oDefect.defectCode || "",
                defectName: oDefect.name || oEvent.getSource().getText(),

                meterReading: fMeterReading.toFixed(2),

                productionOrder: oSelection.productionOrder,
                salesOrder: oSelection.salesOrder,
                salesOrderItem: oSelection.salesOrderItem,
                product: oSelection.product,
                productDescription: oSelection.productDescription,
                quantity: oSelection.quantity,
                uom: oSelection.uom,
                fromStorageLocation: oSelection.fromStorageLocation,
                toStorageLocation: oSelection.toStorageLocation,
                shift: oSelection.shift,
                inspectedQuantity: oSelection.inspectedQuantity,
                inspectedUom: oSelection.inspectedUom,
                netWeight: oSelection.netWeight,
                grossWeight: oSelection.grossWeight,
                tareWeight: oSelection.tareWeight,
                operator: oSelection.operator,
                machineName: oSelection.machineName,

                process: oSelection.process,
                processName: oSelection.processName || oDefect.processName || "",

                timestamp: new Date().toLocaleString()
            });

            oViewModel.setProperty("/capturedDefects", aCapturedDefects);
            oViewModel.setProperty("/selection/meterReading", (fMeterReading + 5).toFixed(2));

            MessageToast.show("Defect added.");
        },

        onDeleteDefect: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("vm");

            if (!oContext) {
                return;
            }

            var iIndex = parseInt(oContext.getPath().split("/").pop(), 10);
            var oViewModel = this.getView().getModel("vm");
            var aCapturedDefects = (oViewModel.getProperty("/capturedDefects") || []).slice();

            if (Number.isInteger(iIndex) && iIndex >= 0 && iIndex < aCapturedDefects.length) {
                aCapturedDefects.splice(iIndex, 1);
                oViewModel.setProperty("/capturedDefects", aCapturedDefects);
            }
        },

        onCancel: function () {
            var oViewModel = this.getView().getModel("vm");
            var aProcesses = oViewModel.getProperty("/processes") || [];
            var oDefaultProcess = aProcesses[0] || {};

            oViewModel.setProperty("/selection", {
                productionOrder: "",
                salesOrder: "",
                salesOrderItem: "",
                product: "",
                productDescription: "",
                quantity: "",
                uom: "",
                fromStorageLocation: "1225",
                toStorageLocation: "1226",
                shift: "A",
                inspectedQuantity: "",
                inspectedUom: "",
                netWeight: "",
                grossWeight: "",
                tareWeight: "",
                process: oDefaultProcess.key || "",
                processName: oDefaultProcess.text || "",
                meterReading: "",
                operator: "",
                machineName: ""
            });

            oViewModel.setProperty("/capturedDefects", []);
            this._setCurrentDefectsByProcess(oDefaultProcess.key || "");

            MessageToast.show("Inspection entry reset.");
        },

        onFinalSubmit: function () {
            var oViewModel = this.getView().getModel("vm");
            var aCapturedDefects = oViewModel.getProperty("/capturedDefects") || [];

            if (!aCapturedDefects.length) {
                MessageToast.show("No captured defects to submit.");
                return;
            }

            MessageBox.information(
                "The inspection log is ready, but backend submission is not configured in the current OData service. No data has been cleared.",
                {
                    title: "Submission Not Configured"
                }
            );
        }
    });
});
