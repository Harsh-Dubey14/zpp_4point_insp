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
            this._oDefectsMap = this._getDefectsMap();

            var oViewModel = new JSONModel({
                busy: false,
                productionOrders: [],
                processes: [
                    { key: "weaving", text: "Weaving" },
                    { key: "process", text: "Process" },
                    { key: "cire", text: "Cire" },
                    { key: "tpu", text: "TPU" },
                    { key: "pur", text: "PUR" },
                    { key: "glue_machine", text: "Glue Machine" },
                    { key: "calendar", text: "Calendar" }
                ],
                currentDefects: this._oDefectsMap.weaving,
                capturedDefects: [],
                selection: {
                    productionOrder: "",
                    salesOrder: "",
                    salesOrderItem: "",
                    product: "",
                    productDescription: "",
                    quantity: "",
                    uom: "",
                    process: "weaving",
                    meterReading: ""
                }
            });

            oViewModel.setSizeLimit(1000);
            this.getView().setModel(oViewModel, "vm");
            this._loadProductionOrders();
        },

        _loadProductionOrders: function () {
            var oViewModel = this.getView().getModel("vm");
            var oSapApp = this.getOwnerComponent().getManifestEntry("sap.app");
            var sServiceUrl = oSapApp.dataSources.mainService.uri;
            var sRequestUrl = sServiceUrl.replace(/\/?$/, "/") + "productordvh?$top=1000";

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
                        (oResponseData.value ||
                            (oResponseData.d && oResponseData.d.results) ||
                            []);

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
                    search: this.onProductionOrderValueHelpSearch.bind(this),
                    confirm: this.onProductionOrderValueHelpConfirm.bind(this),
                    columns: [
                        new Column({ header: new Text({ text: "Production Order" }) }),
                        new Column({ header: new Text({ text: "Product" }) }),
                        new Column({ header: new Text({ text: "Product Description" }) }),
                        new Column({ header: new Text({ text: "Sales Order" }) }),
                        new Column({ header: new Text({ text: "Sales Order Item" }) }),
                        new Column({ header: new Text({ text: "UOM" }) }),
                        new Column({ header: new Text({ text: "Quantity" }) })
                    ]
                });

                this._oProductionOrderDialog.bindAggregation("items", {
                    path: "vm>/productionOrders",
                    template: new ColumnListItem({
                        cells: [
                            new Text({ text: "{vm>Product_Order}" }),
                            new Text({ text: "{vm>Product}" }),
                            new Text({ text: "{vm>ProductDescription}" }),
                            new Text({ text: "{vm>SalesOrder}" }),
                            new Text({ text: "{vm>SalesOrderItem}" }),
                            new Text({ text: "{vm>Uom}" }),
                            new Text({ text: "{vm>Qty}" })
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
            var sProcessKey = oEvent.getSource().getSelectedKey();
            var aDefects = this._oDefectsMap[sProcessKey] || [];

            this.getView().getModel("vm").setProperty("/selection/process", sProcessKey);
            this.getView().getModel("vm").setProperty("/currentDefects", aDefects);
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

            if (!oSelection.meterReading) {
                MessageToast.show("Please enter Meter Reading first.");
                return;
            }

            var fMeterReading = Number(oSelection.meterReading);

            if (!Number.isFinite(fMeterReading) || fMeterReading < 0) {
                MessageToast.show("Please enter a valid non-negative Meter Reading.");
                return;
            }

            var aCapturedDefects = (oViewModel.getProperty("/capturedDefects") || []).slice();

            aCapturedDefects.push({
                defectName: oEvent.getSource().getText(),
                meterReading: fMeterReading.toFixed(2),
                productionOrder: oSelection.productionOrder,
                salesOrder: oSelection.salesOrder,
                salesOrderItem: oSelection.salesOrderItem,
                product: oSelection.product,
                quantity: oSelection.quantity,
                uom: oSelection.uom,
                process: oSelection.process,
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
        },

        _getDefectsMap: function () {
            return {
                weaving: [
                    { name: "Weft Cut" },
                    { name: "Jhiri" },
                    { name: "Cheera" },
                    { name: "Chappa" },
                    { name: "Loom Dagi" },
                    { name: "Design Cut" },
                    { name: "Tight End" },
                    { name: "Tight Pick" },
                    { name: "Float" },
                    { name: "Loose Pick" },
                    { name: "Weft Patta" },
                    { name: "Weft Line" },
                    { name: "Warp Patta" },
                    { name: "Warp Line" },
                    { name: "Un Texture" },
                    { name: "Wrong Design" },
                    { name: "Repture" },
                    { name: "Section Wise Line" },
                    { name: "Yarn Line" },
                    { name: "Double Pick" },
                    { name: "Fabric Hole" },
                    { name: "Slippage" },
                    { name: "Yarn Breakge" },
                    { name: "Stop Line" }
                ],
                process: [
                    { name: "PH Colour Stain" },
                    { name: "PH Oil Stain" },
                    { name: "PH Fabric Crease" },
                    { name: "Selvedge Loose" },
                    { name: "Stenter Pin Out" },
                    { name: "Bow/Skew" },
                    { name: "Abrasion" },
                    { name: "Moyar" },
                    { name: "Jet Mark" }
                ],
                cire: [
                    { name: "Fabric Crease (Chunnat)" },
                    { name: "Cire Stain" },
                    { name: "Cire Fabric Shine" }
                ],
                tpu: [
                    { name: "TPU Glue Stain" },
                    { name: "TPU Fabric Crease" },
                    { name: "TPU Film Crease" },
                    { name: "TPU Air Bubble" }
                ],
                pur: [
                    { name: "PUR Stain" },
                    { name: "PUR Fabric Crease" },
                    { name: "PRU Film Crease" },
                    { name: "PUR Air Bubble" }
                ],
                "glue_machine": [
                    { name: "Glue Stain" },
                    { name: "Fabric Crease (Chunnat)" },
                    { name: "GSM Hole" },
                    { name: "PA Line/Stain" },
                    { name: "PU Line/Stain" }
                ],
                calendar: [
                    { name: "Pin Hole" },
                    { name: "Cal Fab.Crease (Chunnat)" },
                    { name: "Cal.Colour Stain" },
                    { name: "Cal.Oil Stain" },
                    { name: "GSM Hole" },
                    { name: "High GSM" },
                    { name: "Low GSM" },
                    { name: "High Guage" },
                    { name: "Low Guage" },
                    { name: "PVC Out" },
                    { name: "PVC Lump" },
                    { name: "Water Pressure Fail" }
                ]
            };
        }
    });
});
