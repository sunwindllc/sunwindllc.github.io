$(document).ready(function(){
  const inputs = document.querySelectorAll("input")
  let inputValueList = JSON.parse(localStorage.getItem("inputValues")) || []

  function populateInputs(a = [], aList) {
    a.forEach((a, i) => {
      if (aList[i]) return a.value = aList[i]
    })
  }
  populateInputs(inputs, inputValueList)

  $("#date_picker").datetimepicker({
      viewMode: "months",
      format: "MM/YYYY"
  })

  let orig = $("#array_row_0")
      array_index = 0
      max_array_index = 4     // No more than 5 arrays total
      $.fn.appendAttr = function(attrName, suffix) {
        this.attr(attrName, function(i, val) {
          return val + "_" + suffix
        })
        return this
      }

// Clone the first array and give everything a unique name and id
  $("#add_array").on("click", function() {
    $("#remove_array").removeClass("disabled")
    if (array_index < max_array_index) {
      array_index++
      let cln = orig.clone(true)
      $(".array:last").after(cln)
      cln.attr("id", "array_row_" + array_index)
      $(".array:last > div label").appendAttr("for", array_index)
      $(".array:last > div input").appendAttr("id", array_index)
                                  .appendAttr("name", array_index)
      $(".array:last > div select").appendAttr("id", array_index)
                                  .appendAttr("name", array_index)
      if (array_index == max_array_index) {
        $("#add_array").addClass("disabled")
      }
    }
  })

  $("#remove_array").on("click", function() {
    $("#add_array").removeClass("disabled")
    if (array_index > 0) {
      array_index--
      $(".array:last").remove()
      if (array_index == 0) {
        $("#remove_array").addClass("disabled")
      }
    }
  })

  $("[id^=tilt]").blur(function() {
    if ($(this).val().includes(":")) {
      let a = $(this).val().split(":")
      $(this).val(Math.round((Math.atan(+a[0] / +a[1]) * 180 / Math.PI) * 10) / 10)
    } else if ($(this).val().includes("/")) {
      let a = $(this).val().split("/")
      $(this).val(Math.round((Math.atan(+a[0] / +a[1]) * 180 / Math.PI) * 10) / 10)
    }
  })

  let system_capacity = 0

  function getSystemCapacity() {
    system_capacity = 0
    for (i = 0; i <= array_index; i++) {
      system_capacity += ($("#array_row_" + i + " [name^='quantity']").val() * $("#array_row_" + i + " [name^='module_wattage']").val());
    }
  }

  $("[id^=quantity]").blur(function() {
    if ($("#price_per_watt").val() != "" && $(this).val() != "") {
      getSystemCapacity()
      $("#total_price").val(function() {
        return Math.round($("#price_per_watt").val() * system_capacity)
      })
    }
  })

  $("[id^=module_wattage]").blur(function() {
    if ($("#price_per_watt").val() != "") {
      getSystemCapacity()
      $("#total_price").val(function() {
        return Math.round($("#price_per_watt").val() * system_capacity)
      })
    }
  })

  $("#price_per_watt").blur(function() {
    getSystemCapacity()
    $("#total_price").val(function() {
      return Math.round($("#price_per_watt").val() * system_capacity)
    })
  })

  $("#total_price").blur(function() {
    getSystemCapacity()
    $("#price_per_watt").val(function() {
      return Math.round(($("#total_price").val() / system_capacity) * 100) / 100
    })
  })

  $("#form").submit(function(event) {
    event.preventDefault()

    let promises = [], ac_monthly_array = []

    getSystemCapacity()

    inputValueList = []
    inputs.forEach(input => {
      inputValueList.push(input.value)
    })
    console.log(JSON.stringify(inputValueList))
    localStorage.setItem("inputValues", JSON.stringify(inputValueList))

    for (i = 0; i <= array_index; i++) {
      let formData = {
        "api_key"           : "iN1jnldIv9Eojvl9q9nByGdRGQMsxUddk00pWub3",
        "system_capacity"   : $("#array_row_" + i + " [name^='quantity']").val() * $("#array_row_" + i + " [name^='module_wattage']").val() / 1000,
        "module_type"       : $("#array_row_" + i + " [name^='module_type']").val(),
        "losses"            : $("#array_row_" + i + " [name^='losses']").val(),
        "array_type"        : $("#array_row_" + i + " [name^='array_type']").val(),
        "tilt"              : $("#array_row_" + i + " [name^='tilt']").val(),
        "azimuth"           : $("#array_row_" + i + " [name^='azimuth']").val(),
        "file_id"           : "0-14739"   // Boston
      }

      let request = $.ajax({
        type        : "GET",
        url         : "https://developer.nrel.gov/api/pvwatts/v5.json",
        data        : formData,
        dataType    : "json",
        encode      : true
      })
      .done(function(data) {
        console.log(data)
        ac_monthly_array.push(data.outputs.ac_monthly)
      })

      promises.push(request)
    }

    $.when.apply(null, promises).done(function() {

      let total_price = +$("#total_price").val(),
          srec_market_sector = +$("#srec_market_sector").val(),
          utility_rate_incr = +$("#utility_rate_incr").val() / 100,
          utility_rate = +$("#utility_rate").val() / 100,
          current_utility_rate = 0,
          price_per_watt = +$("#price_per_watt").val()
          parse_month = d3.timeParse("%m"),
          format_month = d3.timeFormat("%b"),
          parse_date = d3.timeParse("%m/%Y"),
          format = d3.timeFormat("%b %Y"),
          parse = d3.timeParse("%b %Y"),
          date = parse_date($("#start_date").val()),
          data_first_year = [],
          data_monthly = [],
          data_quarterly = [],
          data_annual = [],
          system_summary = [],
          initial_srec_value = +$("#initial_srec_value").val(),
          month_number = 0,
          quarter_number = 0,
          current_month = 0,
          performance_factor = 0,
          per_annum_degradation = 0.007, // Make this a form input
          srec_annual_degradation = 0.05, // Make this a form input
          monthly_output = 0,
          cumulative_output = 0,
          srec_cumulative_output = 0,
          net_metering_savings_accrued = 0,
          net_metering_savings_monthly = 0,
          current_srec_value = 0,
          srecs_accrued = 0,
          srecs_accrued_quarterly = 0,
          srec_revenue_accrued = 0,
          srec_revenue_quarterly = 0,
          current_system_value = 0,
          state_rebate = d3.min([(0.15 * total_price), 1000]),
          nantucket_rebate = +$("#nantucket_rebate").val(),
          federal_tax_credit = 0.3 * (total_price - nantucket_rebate),
          system_cost_after = total_price - state_rebate - federal_tax_credit - nantucket_rebate,
          initial_system_value = -(system_cost_after)

      // HOW DOES THIS WORK?!?
      // The first part (map and map) returns the transposed (!) matrix,
      // the second part (reduce) sums each nested array
      // the third part (map) adds month_name
      let data = ac_monthly_array[0]
        .map((a, b) => ac_monthly_array.map((c) => c[b])
        .reduce((a, b) => a + b))
        .map((a, b) => [format_month(parse_month(b + 1)), a])

      const ac_monthly_consumed = [
        $("#usage_data_01").val(),
        $("#usage_data_02").val(),
        $("#usage_data_03").val(),
        $("#usage_data_04").val(),
        $("#usage_data_05").val(),
        $("#usage_data_06").val(),
        $("#usage_data_07").val(),
        $("#usage_data_08").val(),
        $("#usage_data_09").val(),
        $("#usage_data_10").val(),
        $("#usage_data_11").val(),
        $("#usage_data_12").val()
      ]

      data.map((a, b, c) => { c[b].push(+ac_monthly_consumed[b]) })

      const maintenanceSchedule = [
        0,
        0,
        0,
        250,
        0,
        0,
        300,
        0,
        0,
        350,
        0,
        0,
        400,
        0,
        0,
        450,
        0,
        0,
        500,
        0,
        0,
        550,
        0,
        0,
        600,
        0,
        0,
        0,
        0,
        0
      ]

      const insurancePerYear = 75
      let srec_revenue_annual = 0,
          srec_revenue_accrued_last_year = 0,
          net_metering_savings_annual = 0,
          net_metering_savings_accrued_last_year = 0

      data.forEach((a) => {
        data_first_year.push({
          "Month"                 : a[0],
          "Energy Generated"      : a[1],
          "Energy Consumed"       : a[2],
          "Electric Bill Before"  : a[2] * utility_rate,
          "Electric Bill After"   : (a[2] - a[1]) * utility_rate})
      })

      let annual_production = d3.sum(data_first_year, ((d) => d["Energy Generated"]))

      for (i = 0; i <= (25 * 12); i++) {
        month_number = date.getMonth()
        current_month = format(date)
        performance_factor = 1 - ((i / 12) * per_annum_degradation)
        monthly_output = data[month_number][1] * performance_factor
        cumulative_output += monthly_output

        if (i < (10 * 12)) {
          current_srec_value = initial_srec_value * (1 - ((i / 12) * srec_annual_degradation))
          srec_cumulative_output += srec_market_sector * monthly_output
        }
        else { current_srec_value = 0; }

        if ((month_number + 1) % 3 == 0) {
          quarter_number++

          if (i < (10 * 12)) {
            srecs_accrued_quarterly = Math.floor(srec_cumulative_output / 1000)
            srecs_accrued += srecs_accrued_quarterly
            srec_revenue_quarterly = srecs_accrued_quarterly * current_srec_value
            srec_cumulative_output = srec_cumulative_output % 1000
            srec_revenue_accrued += srec_revenue_quarterly
          }

          data_quarterly.push({
            "Month"           : current_month,
            "SRECs accrued"   : srecs_accrued,
            "SREC revenue"    : Math.round(srec_revenue_accrued),
            "Quarter number"  : quarter_number
          })
        }

        current_utility_rate = (utility_rate * (1 + (i / 12) * utility_rate_incr))
        net_metering_savings_monthly = monthly_output * current_utility_rate
        net_metering_savings_accrued += net_metering_savings_monthly
        current_system_value = initial_system_value + net_metering_savings_accrued + srec_revenue_accrued
        data_monthly.push({
          "Index"           : i,
          "Month"           : current_month,
          "System value"    : Math.round(current_system_value),
          "Monthly output"  : Math.round(monthly_output) + " kWh AC",
          "Utility rate"    : Math.round(current_utility_rate)
        })

        if (i / 12 != 0 && i % 12 === 0) {
          const insurance = Math.round(insurancePerYear * (1 + (i / 12) * .02))
          srec_revenue_annual = Math.round(srec_revenue_accrued - srec_revenue_accrued_last_year)
          net_metering_savings_annual = Math.round(net_metering_savings_accrued - net_metering_savings_accrued_last_year)

          data_annual.push({
            "Year"                  : i / 12,
            "Calendar year"         : date.getFullYear(),
            "Maintenance"           : maintenanceSchedule[i/12] != "0" ? maintenanceSchedule[i/12] : "",
            "Insurance"             : Math.round(insurancePerYear * (1 + (i / 12) * .02)),
            "SREC revenue"          : srec_revenue_annual != "0" ? srec_revenue_annual : "",
            "Net metering savings"  : net_metering_savings_annual,
            "Net income"            : srec_revenue_annual + net_metering_savings_annual - Math.round(insurancePerYear * (1 + (i / 12) * .02)) - maintenanceSchedule[i/12]
          })
          srec_revenue_accrued_last_year = srec_revenue_accrued
          net_metering_savings_accrued_last_year = net_metering_savings_accrued

        }

        date.setMonth(date.getMonth() + 1)
      }

      console.log("data: " + JSON.stringify(data))

      payback = data_monthly.find((d) => d["System value"] >= 0 )

      system_summary = {
        "Nameplate capacity"                  : system_capacity / 1000 + " kW DC",
        "Annual production (first year)"      : Math.round(annual_production).toLocaleString("en-US") + " kWh AC",
        "Annual production (average)"         : Math.round(cumulative_output / 25).toLocaleString("en-US") + " kWh AC",
        "State rebate value"                  : state_rebate.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3),
        "Federal ITC value"                   : federal_tax_credit.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3),
        "System cost less incentives"         : system_cost_after.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3),
        "Payback date"                        : payback != null ? payback["Month"] : "Never",
        "Payback period"                      : (payback["Index"] + 1) % 12 == 0 ?
                                                Math.floor((payback["Index"] + 1) / 12) + " years" :
                                                (payback["Index"] + 1) % 12 == 1 ?
                                                Math.floor((payback["Index"] + 1) / 12) + " years, 1 month" :
                                                Math.floor((payback["Index"] + 1) / 12) + " years, " + (payback["Index"] + 1) % 12 + " months",
        "Total SRECs generated"               : srecs_accrued
      }



      render(system_summary, data_first_year, data_monthly, data_quarterly, data_annual)
      render_p(srec_market_sector, annual_production, initial_srec_value, utility_rate, system_cost_after)
      render_table(data_annual)
    })
  })
})

function render_table(data_annual) {
  const table = d3.select("#output_table")
  table.html("")

  const thead = table.append("table").attr("class","table").attr("id","annual_production_table").append("thead").append("tr")

  thead.append("th").text("Calendar year")
  thead.append("th").text("Maintenance")
  thead.append("th").text("Insurance")
  thead.append("th").text("SREC revenue")
  thead.append("th").text("Net metering savings")
  thead.append("th").text("Net income")

  const tbody = d3.select("#annual_production_table").append("tbody")
  const trow = tbody.selectAll("tr")
                    .data(data_annual)
                    .enter()
                    .append("tr")
  trow.append("td").text((d) => d["Calendar year"])
  trow.append("td").text((d) => d["Maintenance"].toLocaleString("en-US",{style:"currency",currency:"USD"}).slice(0, -3))
  trow.append("td").text((d) => d["Insurance"].toLocaleString("en-US",{style:"currency",currency:"USD"}).slice(0, -3))
  trow.append("td").text((d) => d["SREC revenue"].toLocaleString("en-US",{style:"currency",currency:"USD"}).slice(0, -3))
  trow.append("td").text((d) => d["Net metering savings"].toLocaleString("en-US",{style:"currency",currency:"USD"}).slice(0, -3))
  trow.append("td").text((d) => d["Net income"].toLocaleString("en-US",{style:"currency",currency:"USD"}).slice(0, -3))

}

function render_p(srec_market_sector, annual_production, initial_srec_value, utility_rate, system_cost_after) {
  let p = d3.select("#output_p")
  const totalAnnualIncome = Math.round(annual_production) * (utility_rate + srec_market_sector * (initial_srec_value / 1000))

  p.html("")

  p.append("div")
    .html(`
      <h4>Revenue / Savings (First Year)</h4>

        <p><b>SREC II Revenue:</b> [${Math.round(annual_production).toLocaleString("en-US")} kWh &times; ${srec_market_sector * 100}%] &times; $${initial_srec_value / 1000}/kWh (current SREC rate) = ${Math.round(Math.round(annual_production) * srec_market_sector * (initial_srec_value / 1000)).toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)}</p>

        <p><b>Net Metering Savings:</b> ${Math.round(annual_production).toLocaleString("en-US")} kWh &times; $${utility_rate}/kWh = ${Math.round(Math.round(annual_production) * utility_rate).toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)}</p>

        <p><b>Total Annual Income:</b> ${Math.round(totalAnnualIncome).toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)}</p>
      `
    )

  p.append("div")
    .html(`
      <p><b>Balance After First Year Savings and Revenue:</b> ${system_cost_after.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)} - ${totalAnnualIncome.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)} = ${(system_cost_after - totalAnnualIncome).toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)}</p>

      <p><b>Simple ROI:</b> ${system_cost_after.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)} &divide; ${totalAnnualIncome.toLocaleString("en-US", {style: "currency", currency: "USD"}).slice(0, -3)} = ${(system_cost_after / totalAnnualIncome).toLocaleString("en-US")}</p>
    `
  )
}

function render(system_summary, data_first_year, data_monthly, data_quarterly, data_annual) {

  let svg, margin, width, height, g

  let div = d3.select("#output_0")

  div.html("") // HACK!!!

  div.append("h5").text("System summary")

  let tbody = div.append("table")
                 .attr("class", "table")
                 .append("tbody")

  let tr = tbody.selectAll("tr")
    .data(Object.entries(system_summary))
    .enter()
    .append("tr")

  tr.append("td")
    .attr("class", "col-xs-6")
    .text((d) => d[0] + ":")
  tr.append("td")
    .attr("class", "col-xs-6")
    .text((d) => d[1])

  svg = d3.select("#output_1").select("svg")

  svg.html("") // HACK!!!

  width = +svg.attr("width")
  height = +svg.attr("height")

  g = svg.append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  let z = d3.scaleOrdinal()
            .range(["#ff8c00", "#98abc5"]),
      radius = Math.min(width, height) / 2;

      var path = d3.arc()
          .outerRadius(radius - 10)
          .innerRadius(radius - 60);

      var pie = d3.pie()
          .sort(null)
          .value((d) => d);

      var dataPie = [d3.sum(data_first_year, ((d) => d["Energy Generated"])), (d3.sum(data_first_year, ((d) => d["Energy Consumed"])) - d3.sum(data_first_year, ((d) => d["Energy Generated"])))]

      let format_percent = d3.format(".0%")

        arc = g.selectAll(".arc")
            .data(pie(dataPie))
          .enter().append("g")
            .attr("class", "arc");

        arc.append("path")
            .attr("d", path)
        	.data(dataPie)
            .style("fill", function(d) { return z(d); });

        g.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "-1.5em")
            .text("This system")
        g.append("text")
           .attr("text-anchor", "middle")
           .text("will provide for " + format_percent(d3.sum(data_first_year, ((d) => d["Energy Generated"])) / d3.sum(data_first_year, ((d) => d["Energy Consumed"]))) + " of")
        g.append("text")
           .attr("dy", "1.4em")
           .attr("text-anchor", "middle")
           .text("your energy needs.")


///////////////////////

      svg = d3.select("#output_2").select("svg")

      svg.html("") // HACK!!!

      margin = {top: 20, right: 20, bottom: 30, left: 40},
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom,
      g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  let x0 = d3.scaleBand()
      .rangeRound([0, width])
      .paddingInner(0.1);

  let x1 = d3.scaleBand()
      .padding(0.05);

  let y = d3.scaleLinear()
      .rangeRound([height, 0]);

   z = d3.scaleOrdinal()
    .range(["#ff8c00", "#98abc5"]);

  var keys = ["Energy Generated", "Energy Consumed"];

  x0.domain(data_first_year.map(function(d) { return d.Month; }));
  x1.domain(keys).rangeRound([0, x0.bandwidth()]);
  y.domain([0, d3.max(data_first_year, function(d) { return d3.max(keys, function(key) { return d[key]; }); })]).nice();

  g.append("g")
    .selectAll("g")
    .data(data_first_year)
    .enter().append("g")
      .attr("transform", function(d) { return "translate(" + x0(d.Month) + ",0)"; })
    .selectAll("rect")
    .data(function(d) { return keys.map(function(key) { return {key: key, value: d[key]}; }); })
    .enter().append("rect")
      .attr("x", function(d) { return x1(d.key); })
      .attr("y", function(d) { return y(d.value); })
      .attr("width", x1.bandwidth())
      .attr("height", function(d) { return height - y(d.value); })
      .attr("fill", function(d) { return z(d.key); });

 console.log("data_first_year:", JSON.stringify(data_first_year));

  g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x0));

  g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(null))
    .append("text")
      .attr("x", 2)
      .attr("y", y(y.ticks().pop()) + 0.5)
      .attr("dy", "0.32em")
      .attr("fill", "#000")
      .attr("font-weight", "bold")
      .attr("text-anchor", "start")
      .text("kWh");

  var legend = g.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "end")
    .selectAll("g")
    .data(keys.slice().reverse())
    .enter().append("g")
      .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

  legend.append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", z);

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(function(d) { return d; });

////////

      svg = d3.select("#output_3").select("svg")

      svg.html("") // HACK!!!

      margin = {top: 20, right: 20, bottom: 30, left: 40},
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom,
      g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

   x0 = d3.scaleBand()
          .rangeRound([0, width])
          .paddingInner(0.1);

   x1 = d3.scaleBand()
          .padding(0.05);

   y = d3.scaleLinear()
         .rangeRound([height, 0]);

   z = d3.scaleOrdinal()
         .range(["#ff8c00", "#98abc5"].reverse());

   keys = ["Electric Bill Before", "Electric Bill After"];

  x0.domain(data_first_year.map(function(d) { return d.Month; }));
  x1.domain(keys).rangeRound([0, x0.bandwidth()]);

  y.domain([
    d3.min(data_first_year, (d) => d3.min(keys, (key) => d[key])),
    d3.max(data_first_year, (d) => d3.max(keys, (key) => d[key]))
  ]).nice();

  g.append("g")
    .selectAll("g")
    .data(data_first_year)
    .enter().append("g")
      .attr("transform", function(d) { return "translate(" + x0(d.Month) + ",0)"; })
    .selectAll("rect")
    .data(function(d) { return keys.map(function(key) { return {key: key, value: d[key]}; }); })
    .enter().append("rect")
      .attr("x", function(d) { return x1(d.key); })
      .attr("y", (d) => d.value > 0 ?
                        y(d.value) :
                        y(0))
      .attr("width", x1.bandwidth())
      .attr("height", function(d) { return Math.abs(y(d.value) - y(0)); })
      .attr("fill", function(d) { return z(d.key); });

  g.append("g")
      .attr("class", "axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x0));

  g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(null)
              .tickFormat(function(d) {
                return this.parentNode.nextSibling
                ? "\xa0" + d
                : "$" + d;
              }))

   legend = g.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "end")
    .selectAll("g")
    .data(keys.slice())
    .enter().append("g")
      .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

  legend.append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", z);

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text((d) => d);


////

  svg = d3.select("#output_4").select("svg")

  svg.html("") // HACK!!!

  margin = {top: 10, right: 10, bottom: 20, left: 50},
  width = +svg.attr("width") - margin.left - margin.right,
  height = +svg.attr("height") - margin.top - margin.bottom,
  g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")")

  y = d3.scaleLinear()
        .domain(d3.extent(data_monthly, (d) => d["System value"])).nice()
        .rangeRound([height, 0])

  x = d3.scaleTime()
        .domain(d3.extent(data_monthly, (d) => parse(d["Month"])))
        .rangeRound([0, width])

  let area = d3.area()
               .x((d) => x(parse(d["Month"])))
               .y1((d) => y(d["System value"]))
               .y0(y(0)),
      line = d3.line()
               .x((d) => x(parse(d["Month"])))
               .y((d) => y(d["System value"]))


   svg.append("svg:clipPath")
     .attr("id", "clipTop")
   .append("svg:rect")
     .attr("height", y(0))
     .attr("width", width)

   svg.append("svg:clipPath")
     .attr("id", "clipBottom")
   .append("svg:rect")
     .attr("height", height - y(0))
     .attr("width", width)
     .attr("y", y(0))

  g.append("path")
   .datum(data_monthly)
   .attr("d", area)
   .attr("class", "positive")
   .attr("clip-path", "url(#clipTop)")

  g.append("path")
   .datum(data_monthly)
   .attr("d", area)
   .attr("class", "negative")
   .attr("clip-path", "url(#clipBottom)")

  g.append("path")
    .datum(data_monthly)
    .attr("d", line)
    .attr("class", "line")
    .attr("stroke-dasharray", "4,2")
    .attr("stroke-width", "0.5")

  g.append("g")
   .attr("class", "axis")
   .attr("transform", "translate(0," + y(0) + ")")
   .call(d3.axisBottom(x))

  g.append("g")
   .attr("class", "axis")
   .call(d3.axisLeft(y).ticks(null)
           .tickFormat(function(d) {
             let formatNumber = d3.format(",")
             return this.parentNode.nextSibling
             ? "\xa0" + formatNumber(d)
             : "$" + formatNumber(d)
           }))
           .append("text")
             .attr("x", 2)
             .attr("y", y(y.ticks().pop()) + 0.5)
             .attr("dy", "0.32em")
             .attr("fill", "#000")
             .attr("font-weight", "bold")
             .attr("text-anchor", "start")
             .text("Revenue");

}
